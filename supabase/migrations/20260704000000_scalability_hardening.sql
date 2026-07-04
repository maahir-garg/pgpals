-- Scalability/concurrency hardening for the live event shape.
--
-- The app already keeps participant writes behind RPCs. This migration makes
-- the RPCs safe under simultaneous clicks/reviews, reduces leaderboard work to
-- one aggregate pass, and adds small admin aggregate RPCs so admin pages do
-- not fetch full submission tables just to count them.

-- ---------------------------------------------------------------------------
-- Indexes for the hot paths: review queue, score aggregation, participant
-- task status, pair lookups, and admin counts.
-- ---------------------------------------------------------------------------

create index if not exists submissions_status_submitted_idx
  on public.submissions (status, submitted_at);

create index if not exists submissions_task_team_status_idx
  on public.submissions (task_id, team_id, status);

create index if not exists submissions_task_pairing_status_idx
  on public.submissions (task_id, pairing_id, status)
  where pairing_id is not null;

create index if not exists submissions_approved_task_idx
  on public.submissions (task_id)
  where status = 'approved';

create index if not exists submissions_submitted_at_idx
  on public.submissions (submitted_at);

create index if not exists pairings_task_status_team_a_idx
  on public.pairings (task_id, status, team_a);

create index if not exists pairings_task_status_team_b_idx
  on public.pairings (task_id, status, team_b);

create index if not exists bonus_awards_team_idx
  on public.bonus_awards (team_id);

create index if not exists announcements_feed_idx
  on public.announcements (pinned desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Advisory-lock helpers. Transaction-scoped locks serialize the small pieces
-- of state where "check then insert/update" must be atomic.
-- ---------------------------------------------------------------------------

create or replace function public.lock_submission_scope(
  p_task uuid,
  p_team uuid,
  p_pairing uuid default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'pgpals_submission:' || p_task::text || ':' ||
        coalesce(p_pairing::text, p_team::text),
      0
    )
  );
end $$;

create or replace function public.lock_pairing_scope(
  p_task uuid,
  p_team_a uuid,
  p_team_b uuid
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_first text := least(p_team_a::text, p_team_b::text);
  v_second text := greatest(p_team_a::text, p_team_b::text);
begin
  perform pg_advisory_xact_lock(
    hashtextextended('pgpals_pairing:' || p_task::text || ':' || v_first, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('pgpals_pairing:' || p_task::text || ':' || v_second, 0)
  );
end $$;

revoke execute on function public.lock_submission_scope(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.lock_pairing_scope(uuid, uuid, uuid)
  from public, anon, authenticated;

-- One round trip for server layouts/pages to load the current profile. The
-- JWT is verified by PostgREST before auth.uid() is set; middleware still
-- handles refresh-token cookie rotation.
create or replace function public.get_my_profile()
returns setof public.profiles
language sql stable security definer set search_path = public, pg_temp as $$
  select *
  from profiles
  where id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_profile() to authenticated;

-- Keep direct admin writes from creating two live pairings for the same team
-- on the same task. The same trigger also protects the RPCs.
create or replace function public.guard_live_pairing()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.team_a = new.team_b then
    raise exception 'A team cannot pair with itself.';
  end if;

  if new.status in ('pending', 'accepted') then
    perform public.lock_pairing_scope(new.task_id, new.team_a, new.team_b);
    if exists (
      select 1
      from pairings p
      where p.task_id = new.task_id
        and p.status in ('pending', 'accepted')
        and p.id <> new.id
        and (p.team_a in (new.team_a, new.team_b)
             or p.team_b in (new.team_a, new.team_b))
    ) then
      raise exception 'One of the teams already has a live pairing for this task.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists pairings_live_guard on public.pairings;
create trigger pairings_live_guard
  before insert or update of task_id, team_a, team_b, status on public.pairings
  for each row execute function public.guard_live_pairing();

-- ---------------------------------------------------------------------------
-- Faster leaderboard: one aggregate pass instead of calling team_score() per
-- row. Pair submissions credit each distinct team involved exactly once.
-- ---------------------------------------------------------------------------

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
        select distinct v.team_id
        from (values (s.team_id), (p.team_a), (p.team_b)) as v(team_id)
        where v.team_id is not null
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

-- ---------------------------------------------------------------------------
-- Submission RPCs with serialized scopes and approval-time max rechecks.
-- ---------------------------------------------------------------------------

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
      raise exception 'Pair tasks need an accepted partner team first.';
    end if;
    select * into v_pairing from pairings where id = p_pairing;
    if not found or v_pairing.task_id <> p_task or v_pairing.status <> 'accepted'
       or (v_pairing.team_a <> v_team and v_pairing.team_b <> v_team) then
      raise exception 'Invalid pairing for this task.';
    end if;

    perform public.lock_submission_scope(p_task, v_team, p_pairing);

    select count(*) filter (where status = 'approved'),
           bool_or(status = 'pending')
      into v_approved, v_pending
      from submissions
      where task_id = p_task
        and (pairing_id = p_pairing or team_id in (v_pairing.team_a, v_pairing.team_b));
  else
    if p_pairing is not null then
      raise exception 'This is not a pair task.';
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

create or replace function public.create_pair_invite(p_task uuid, p_partner uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid := my_team_id();
  v_task tasks%rowtype;
  v_id uuid;
begin
  if v_team is null then raise exception 'You are not on a team yet.'; end if;
  select * into v_task from tasks where id = p_task;
  if not found or v_task.type <> 'pair' or not v_task.is_published or v_task.release_at > now() then
    raise exception 'This task is not open for pairing.';
  end if;
  if now() > v_task.deadline_at then
    raise exception 'The deadline for this task has passed.';
  end if;
  if p_partner = v_team then
    raise exception 'You cannot pair with your own team.';
  end if;
  if not exists (select 1 from teams where id = p_partner) then
    raise exception 'Partner team not found.';
  end if;

  perform public.lock_pairing_scope(p_task, v_team, p_partner);

  if exists (select 1 from pairings
             where task_id = p_task and status in ('pending', 'accepted')
               and (team_a in (v_team, p_partner) or team_b in (v_team, p_partner))) then
    raise exception 'One of the teams already has a pending or accepted pairing for this task.';
  end if;
  insert into pairings (task_id, team_a, team_b, created_by_team)
  values (p_task, v_team, p_partner, v_team)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_pair_invite(p_pairing uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid := my_team_id();
  v_pairing pairings%rowtype;
  v_deadline timestamptz;
begin
  select * into v_pairing from pairings where id = p_pairing for update;
  if not found or v_pairing.status <> 'pending' then
    raise exception 'Invite not found or already answered.';
  end if;
  if v_team is null or v_team = v_pairing.created_by_team
     or (v_team <> v_pairing.team_a and v_team <> v_pairing.team_b) then
    raise exception 'Only the invited team can respond.';
  end if;
  select deadline_at into v_deadline from tasks where id = v_pairing.task_id;
  if p_accept and now() > v_deadline then
    raise exception 'The deadline for this task has passed.';
  end if;

  if p_accept then
    perform public.lock_pairing_scope(v_pairing.task_id, v_pairing.team_a, v_pairing.team_b);
  end if;

  if p_accept and exists (select 1 from pairings
      where task_id = v_pairing.task_id and status in ('pending', 'accepted') and id <> p_pairing
        and (team_a in (v_pairing.team_a, v_pairing.team_b) or team_b in (v_pairing.team_a, v_pairing.team_b))) then
    raise exception 'One of the teams has already paired up for this task.';
  end if;
  update pairings set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_pairing;
end $$;

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
        raise exception 'Pairing not found for this submission.';
      end if;
      perform public.lock_submission_scope(v_submission.task_id, v_submission.team_id, v_submission.pairing_id);
      select count(*) into v_approved
      from submissions
      where task_id = v_submission.task_id
        and status = 'approved'
        and (pairing_id = v_submission.pairing_id
             or team_id in (v_pairing.team_a, v_pairing.team_b));
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

-- ---------------------------------------------------------------------------
-- Admin aggregate RPCs used by pages that previously fetched full tables.
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview_stats(p_today_start timestamptz)
returns table (
  pending_count bigint,
  today_count bigint,
  team_count bigint,
  unique_submitters bigint,
  live_tasks bigint
) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;

  return query
    select
      (select count(*) from submissions where status = 'pending') as pending_count,
      (select count(*) from submissions where submitted_at >= p_today_start) as today_count,
      (select count(*) from teams) as team_count,
      (select count(distinct team_id) from submissions) as unique_submitters,
      (select count(*)
       from tasks
       where is_published and release_at <= now() and deadline_at > now()) as live_tasks;
end $$;

create or replace function public.admin_submission_counts_by_task()
returns table (task_id uuid, pending_count bigint, approved_count bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;

  return query
    select t.id,
           count(s.id) filter (where s.status = 'pending') as pending_count,
           count(s.id) filter (where s.status = 'approved') as approved_count
    from tasks t
    left join submissions s
      on s.task_id = t.id and s.status in ('pending', 'approved')
    group by t.id;
end $$;

create or replace function public.admin_submission_status_counts(
  p_task uuid default null,
  p_team uuid default null
) returns table (status text, count bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;

  return query
    select s.status, count(*)
    from submissions s
    where (p_task is null or s.task_id = p_task)
      and (p_team is null or s.team_id = p_team)
    group by s.status;
end $$;
