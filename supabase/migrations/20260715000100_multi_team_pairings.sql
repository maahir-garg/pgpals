-- Generalize pair tasks into groups of 2, 3, or more teams. The original
-- team_a/team_b columns remain populated for compatibility; team_ids is the
-- authoritative membership list.

alter table public.tasks
  add column pair_team_count int not null default 2
  check (pair_team_count between 2 and 20);

alter table public.pairings
  add column team_ids uuid[],
  add column accepted_team_ids uuid[] not null default '{}';

update public.pairings
set team_ids = array[team_a, team_b],
    accepted_team_ids = case
      when status = 'accepted' then array[team_a, team_b]
      else array[created_by_team]
    end;

alter table public.pairings
  alter column team_ids set not null,
  add constraint pairings_team_ids_minimum check (cardinality(team_ids) >= 2),
  add constraint pairings_accepted_team_ids_minimum check (cardinality(accepted_team_ids) >= 1);

create index pairings_team_ids_idx on public.pairings using gin (team_ids);

create or replace function public.pairing_involves_me(p_pairing uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as
$$ select exists (
     select 1 from pairings
     where id = p_pairing and my_team_id() = any(team_ids)
   ) $$;

create or replace function public.lock_pairing_scope(
  p_task uuid,
  p_team_ids uuid[]
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid;
begin
  for v_team in select unnest(p_team_ids) order by 1 loop
    perform pg_advisory_xact_lock(
      hashtextextended('pgpals_pairing:' || p_task::text || ':' || v_team::text, 0)
    );
  end loop;
end $$;

revoke execute on function public.lock_pairing_scope(uuid, uuid[])
  from public, anon, authenticated;

create or replace function public.guard_live_pairing()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_required int;
  v_unique_count int;
  v_existing_count int;
begin
  if cardinality(new.team_ids) < 2 or array_position(new.team_ids, null) is not null then
    raise exception 'A group must contain at least two valid teams.';
  end if;

  select count(distinct team_id) into v_unique_count
  from unnest(new.team_ids) as members(team_id);
  if v_unique_count <> cardinality(new.team_ids) then
    raise exception 'A team cannot appear twice in the same group.';
  end if;

  select pair_team_count into v_required
  from tasks
  where id = new.task_id and type = 'pair';
  if not found or cardinality(new.team_ids) <> v_required then
    raise exception 'This task requires exactly % teams.', coalesce(v_required, 0);
  end if;

  select count(*) into v_existing_count
  from teams where id = any(new.team_ids);
  if v_existing_count <> cardinality(new.team_ids) then
    raise exception 'One or more teams in this group no longer exist.';
  end if;

  if not (new.created_by_team = any(new.team_ids))
     or not (new.created_by_team = any(new.accepted_team_ids))
     or not (new.accepted_team_ids <@ new.team_ids) then
    raise exception 'Invalid group acceptance state.';
  end if;

  select count(distinct team_id) into v_unique_count
  from unnest(new.accepted_team_ids) as accepted(team_id);
  if v_unique_count <> cardinality(new.accepted_team_ids) then
    raise exception 'A team cannot accept a group twice.';
  end if;

  if new.status = 'accepted'
     and cardinality(new.accepted_team_ids) <> cardinality(new.team_ids) then
    raise exception 'Every team must accept before the group is ready.';
  end if;

  new.team_a := new.team_ids[1];
  new.team_b := new.team_ids[2];

  if new.status in ('pending', 'accepted') then
    perform public.lock_pairing_scope(new.task_id, new.team_ids);
    if exists (
      select 1
      from pairings p
      where p.task_id = new.task_id
        and p.status in ('pending', 'accepted')
        and p.id <> new.id
        and p.team_ids && new.team_ids
    ) then
      raise exception 'One of the teams already has a live group for this task.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists pairings_live_guard on public.pairings;
create trigger pairings_live_guard
  before insert or update of task_id, team_ids, accepted_team_ids, status on public.pairings
  for each row execute function public.guard_live_pairing();

create or replace function public.team_score(p_team uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
      select sum(s.points_awarded)
      from submissions s
      left join pairings p on p.id = s.pairing_id
      where s.status = 'approved'
        and (s.team_id = p_team or p_team = any(coalesce(p.team_ids, '{}')))
    ), 0)
    + coalesce((select sum(points) from bonus_awards where team_id = p_team), 0);
$$;

revoke execute on function public.team_score(uuid) from public, anon, authenticated;

create or replace function public.get_leaderboard()
returns table (team_id uuid, team_name text, points int, rank bigint, is_mine boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_hide timestamptz;
begin
  select leaderboard_hide_at into v_hide from event_settings where id = 1;
  if not is_admin() and now() >= v_hide then
    return;
  end if;

  return query
    with submission_points as (
      select credited.team_id,
             coalesce(sum(s.points_awarded), 0)::int as points,
             max(s.reviewed_at) as last_scored_at
      from submissions s
      left join pairings p on p.id = s.pairing_id
      cross join lateral (
        select s.team_id
        union
        select unnest(coalesce(p.team_ids, '{}'))
      ) credited
      where s.status = 'approved'
      group by credited.team_id
    ),
    bonus_points as (
      select b.team_id,
             coalesce(sum(b.points), 0)::int as points,
             max(b.created_at) as last_scored_at
      from bonus_awards b
      group by b.team_id
    ),
    scores as (
      select t.id,
             t.name,
             (coalesce(sp.points, 0) + coalesce(bp.points, 0))::int as points,
             greatest(sp.last_scored_at, bp.last_scored_at) as last_scored_at
      from teams t
      left join submission_points sp on sp.team_id = t.id
      left join bonus_points bp on bp.team_id = t.id
    ),
    ranked as (
      select s.id,
             s.name,
             s.points,
             rank() over (
               order by s.points desc, s.last_scored_at asc nulls last, s.name asc
             ) as rank
      from scores s
    )
    select r.id, r.name, r.points, r.rank, r.id = my_team_id()
    from ranked r
    order by r.rank, r.name;
end $$;

create or replace function public.create_submission(
  p_task uuid,
  p_text text,
  p_photos text[],
  p_pairing uuid default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid := my_team_id();
  v_task tasks%rowtype;
  v_pairing pairings%rowtype;
  v_approved int;
  v_pending boolean;
  v_prev_rejected uuid;
  v_id uuid;
  v_path text;
begin
  if v_team is null then
    raise exception 'You are not on a team yet — ask your RA.';
  end if;

  select * into v_task from tasks where id = p_task;
  if not found or not v_task.is_published or v_task.release_at > now() then
    raise exception 'This task is not open.';
  end if;
  if now() > v_task.deadline_at then
    raise exception 'The deadline for this task has passed.';
  end if;

  if coalesce(array_length(p_photos, 1), 0) < 1 or array_length(p_photos, 1) > 5 then
    raise exception 'Attach 1 to 5 photos.';
  end if;
  foreach v_path in array p_photos loop
    if position(v_team::text || '/' in v_path) <> 1 then
      raise exception 'Invalid photo path.';
    end if;
  end loop;

  if v_task.type = 'pair' then
    if p_pairing is null then
      raise exception 'Group tasks need an accepted group first.';
    end if;
    select * into v_pairing from pairings where id = p_pairing;
    if not found or v_pairing.task_id <> p_task or v_pairing.status <> 'accepted'
       or not (v_team = any(v_pairing.team_ids)) then
      raise exception 'Invalid group for this task.';
    end if;

    perform public.lock_submission_scope(p_task, v_team, p_pairing);

    select count(*) filter (where status = 'approved'),
           bool_or(status = 'pending')
      into v_approved, v_pending
      from submissions
      where task_id = p_task
        and (pairing_id = p_pairing or team_id = any(v_pairing.team_ids));
  else
    if p_pairing is not null then
      raise exception 'This is not a group task.';
    end if;

    perform public.lock_submission_scope(p_task, v_team, null);

    select count(*) filter (where status = 'approved'), bool_or(status = 'pending')
      into v_approved, v_pending
      from submissions
      where task_id = p_task and team_id = v_team;
  end if;

  if coalesce(v_approved, 0) >= v_task.max_submissions then
    raise exception 'This task has already been approved for your team.';
  end if;
  if coalesce(v_pending, false) then
    raise exception 'You already have a submission under review for this task.';
  end if;

  select id into v_prev_rejected from submissions
    where task_id = p_task and status = 'rejected'
      and (team_id = v_team or (p_pairing is not null and pairing_id = p_pairing))
    order by submitted_at desc limit 1;

  update submissions set status = 'superseded'
    where task_id = p_task and status = 'rejected'
      and (team_id = v_team or (p_pairing is not null and pairing_id = p_pairing));

  insert into submissions (task_id, team_id, pairing_id, text_content, photo_paths, resubmission_of)
  values (p_task, v_team, p_pairing, coalesce(p_text, ''), p_photos, v_prev_rejected)
  returning id into v_id;
  return v_id;
end $$;

drop function public.create_pair_invite(uuid, uuid);

create function public.create_pair_invite(p_task uuid, p_partners uuid[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid := my_team_id();
  v_task tasks%rowtype;
  v_team_ids uuid[];
  v_unique_count int;
  v_existing_count int;
  v_id uuid;
begin
  if v_team is null then raise exception 'You are not on a team yet.'; end if;
  select * into v_task from tasks where id = p_task;
  if not found or v_task.type <> 'pair' or not v_task.is_published or v_task.release_at > now() then
    raise exception 'This task is not open for grouping.';
  end if;
  if now() > v_task.deadline_at then
    raise exception 'The deadline for this task has passed.';
  end if;
  if coalesce(cardinality(p_partners), 0) <> v_task.pair_team_count - 1 then
    raise exception 'Choose exactly % partner teams.', v_task.pair_team_count - 1;
  end if;

  v_team_ids := array[v_team] || p_partners;
  select count(distinct team_id) into v_unique_count
  from unnest(v_team_ids) as members(team_id);
  if v_unique_count <> cardinality(v_team_ids) then
    raise exception 'Choose different teams and do not include your own team.';
  end if;
  select count(*) into v_existing_count from teams where id = any(v_team_ids);
  if v_existing_count <> cardinality(v_team_ids) then
    raise exception 'One or more partner teams were not found.';
  end if;

  perform public.lock_pairing_scope(p_task, v_team_ids);

  if exists (
    select 1 from pairings
    where task_id = p_task and status in ('pending', 'accepted')
      and team_ids && v_team_ids
  ) then
    raise exception 'One of the teams already has a pending or accepted group for this task.';
  end if;

  insert into pairings (
    task_id, team_a, team_b, team_ids, accepted_team_ids, created_by_team
  ) values (
    p_task, v_team_ids[1], v_team_ids[2], v_team_ids, array[v_team], v_team
  ) returning id into v_id;
  return v_id;
end $$;

grant execute on function public.create_pair_invite(uuid, uuid[]) to authenticated;

create or replace function public.respond_pair_invite(p_pairing uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid := my_team_id();
  v_pairing pairings%rowtype;
  v_deadline timestamptz;
  v_accepted uuid[];
begin
  select * into v_pairing from pairings where id = p_pairing for update;
  if not found or v_pairing.status <> 'pending' then
    raise exception 'Invite not found or already answered.';
  end if;
  if v_team is null or v_team = v_pairing.created_by_team
     or not (v_team = any(v_pairing.team_ids))
     or v_team = any(v_pairing.accepted_team_ids) then
    raise exception 'Only an invited team that has not responded can answer.';
  end if;
  select deadline_at into v_deadline from tasks where id = v_pairing.task_id;
  if p_accept and now() > v_deadline then
    raise exception 'The deadline for this task has passed.';
  end if;

  if not p_accept then
    update pairings set status = 'declined' where id = p_pairing;
    return;
  end if;

  perform public.lock_pairing_scope(v_pairing.task_id, v_pairing.team_ids);
  if exists (
    select 1 from pairings
    where task_id = v_pairing.task_id
      and status in ('pending', 'accepted')
      and id <> p_pairing
      and team_ids && v_pairing.team_ids
  ) then
    raise exception 'One of the teams has already joined another group for this task.';
  end if;

  v_accepted := array_append(v_pairing.accepted_team_ids, v_team);
  update pairings
  set accepted_team_ids = v_accepted,
      status = case
        when cardinality(v_accepted) = cardinality(v_pairing.team_ids) then 'accepted'
        else 'pending'
      end
  where id = p_pairing;
end $$;

create or replace function public.available_partner_teams(p_task uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, t.name from teams t
  where t.id <> my_team_id()
    and not exists (
      select 1 from pairings p
      where p.task_id = p_task and p.status in ('pending', 'accepted')
        and t.id = any(p.team_ids)
    )
  order by t.name;
$$;

create or replace function public.review_submission(
  p_submission uuid,
  p_approve boolean,
  p_note text default null,
  p_points_override int default null
) returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_submission submissions%rowtype;
  v_task tasks%rowtype;
  v_pairing pairings%rowtype;
  v_points int;
  v_approved int;
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  select * into v_submission from submissions where id = p_submission for update;
  if not found or v_submission.status <> 'pending' then
    raise exception 'Submission not found or already reviewed.';
  end if;
  if p_points_override is not null and p_points_override < 0 then
    raise exception 'Coins must be zero or greater.';
  end if;

  if p_approve then
    select * into v_task from tasks where id = v_submission.task_id;

    if v_submission.pairing_id is not null then
      select * into v_pairing from pairings where id = v_submission.pairing_id;
      if not found then
        raise exception 'Group not found for this submission.';
      end if;
      perform public.lock_submission_scope(
        v_submission.task_id, v_submission.team_id, v_submission.pairing_id
      );
      select count(*) into v_approved
      from submissions
      where task_id = v_submission.task_id
        and status = 'approved'
        and (pairing_id = v_submission.pairing_id
             or team_id = any(v_pairing.team_ids));
    else
      perform public.lock_submission_scope(v_submission.task_id, v_submission.team_id, null);
      select count(*) into v_approved
      from submissions
      where task_id = v_submission.task_id
        and team_id = v_submission.team_id
        and status = 'approved';
    end if;

    if coalesce(v_approved, 0) >= v_task.max_submissions then
      raise exception 'This task already has the maximum approved submissions for that team.';
    end if;

    v_points := coalesce(p_points_override, compute_award(v_task, v_submission));
    update submissions
      set status = 'approved', points_awarded = v_points, reviewer_id = auth.uid(),
          review_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_at = now()
      where id = p_submission;
    return v_points;
  else
    if nullif(trim(coalesce(p_note, '')), '') is null then
      raise exception 'A rejection reason is required.';
    end if;
    update submissions
      set status = 'rejected', points_awarded = null, reviewer_id = auth.uid(),
          review_note = trim(p_note), reviewed_at = now()
      where id = p_submission;
    return 0;
  end if;
end $$;
