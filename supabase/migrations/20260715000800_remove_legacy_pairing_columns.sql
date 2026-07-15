-- Remove compatibility state left behind by the multi-team and
-- single-approval migrations. team_ids is the only group membership source,
-- and one approval is now a fixed invariant rather than configurable data.

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

  if coalesce(v_approved, 0) >= 1 then
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

create or replace function public.create_pair_invite(p_task uuid, p_partners uuid[])
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

  insert into pairings (task_id, team_ids, accepted_team_ids, created_by_team)
  values (p_task, v_team_ids, array[v_team], v_team)
  returning id into v_id;
  return v_id;
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

    if coalesce(v_approved, 0) >= 1 then
      raise exception 'This task already has an approved submission for that team.';
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

-- One database implementation supplies the exact automatic award shown in the
-- review queue and later used by review_submission.
create or replace function public.admin_submission_award_previews(p_submissions uuid[])
returns table (submission_id uuid, points int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;

  return query
    select s.id, public.compute_award(t, s)
    from submissions s
    join tasks t on t.id = s.task_id
    where s.id = any(coalesce(p_submissions, array[]::uuid[]));
end $$;

revoke execute on function public.admin_submission_award_previews(uuid[])
  from public, anon;
grant execute on function public.admin_submission_award_previews(uuid[])
  to authenticated, service_role;

-- Recreate the upload reservation RPC with typed empty arrays and without a
-- shadowed loop variable so plpgsql_check reports no warnings.
create or replace function public.reserve_submission_uploads(
  p_task uuid,
  p_pairing uuid,
  p_files jsonb
) returns table (batch_id uuid, paths text[])
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_team uuid := my_team_id();
  v_task tasks%rowtype;
  v_pairing pairings%rowtype;
  v_file jsonb;
  v_count int;
  v_content_type text;
  v_extension text;
  v_size bigint;
  v_video_count int := 0;
  v_video_bytes bigint := 0;
  v_folder uuid := gen_random_uuid();
  v_paths text[] := array[]::text[];
  v_content_types text[] := array[]::text[];
  v_declared_sizes bigint[] := array[]::bigint[];
  v_approved int;
  v_pending boolean;
  v_batch_id uuid;
begin
  if v_user is null or v_team is null then
    raise exception 'Log in with a team account before uploading.';
  end if;
  if jsonb_typeof(p_files) <> 'array' then
    raise exception 'Choose 1 to 5 supported attachments.';
  end if;

  v_count := jsonb_array_length(p_files);
  if v_count < 1 or v_count > 5 then
    raise exception 'Choose 1 to 5 supported attachments.';
  end if;

  for v_index in 0..v_count - 1 loop
    v_file := p_files -> v_index;
    if jsonb_typeof(v_file) <> 'object'
       or jsonb_typeof(v_file -> 'size') <> 'number' then
      raise exception 'Invalid attachment details.';
    end if;

    v_content_type := lower(trim(v_file ->> 'content_type'));
    v_size := (v_file ->> 'size')::bigint;
    if v_size < 1 then
      raise exception 'Attachments cannot be empty.';
    end if;

    v_extension := case v_content_type
      when 'image/jpeg' then 'jpg'
      when 'image/png' then 'png'
      when 'image/webp' then 'webp'
      when 'video/mp4' then 'mp4'
      when 'video/quicktime' then 'mov'
      when 'video/webm' then 'webm'
      else null
    end;
    if v_extension is null then
      raise exception 'Use JPEG, PNG, WebP, MP4, MOV, or WebM files only.';
    end if;

    if v_content_type like 'image/%' and v_size > 2097152 then
      raise exception 'Each uploaded photo must be 2 MB or smaller after compression.';
    end if;
    if v_content_type like 'video/%' then
      if v_size > 52428800 then
        raise exception 'Each video must be 50 MB or smaller.';
      end if;
      v_video_count := v_video_count + 1;
      v_video_bytes := v_video_bytes + v_size;
    end if;

    v_paths := array_append(
      v_paths,
      v_team::text || '/' || v_folder::text || '/' ||
        (v_index + 1)::text || '.' || v_extension
    );
    v_content_types := array_append(v_content_types, v_content_type);
    v_declared_sizes := array_append(v_declared_sizes, v_size);
  end loop;

  if v_video_count > 3 then
    raise exception 'Add no more than 3 videos.';
  end if;
  if v_video_bytes > 104857600 then
    raise exception 'Videos can total at most 100 MB per submission.';
  end if;

  select * into v_task from tasks where id = p_task;
  if not found or not v_task.is_published or v_task.release_at > now() then
    raise exception 'This task is not open.';
  end if;
  if now() > v_task.deadline_at then
    raise exception 'The deadline for this task has passed.';
  end if;

  if v_task.type = 'pair' then
    if p_pairing is null then
      raise exception 'Group tasks need an accepted group before uploading.';
    end if;
    select * into v_pairing from pairings where id = p_pairing;
    if not found or v_pairing.task_id <> p_task or v_pairing.status <> 'accepted'
       or not (v_team = any(v_pairing.team_ids)) then
      raise exception 'Invalid group for this task.';
    end if;
    perform public.lock_submission_scope(p_task, v_team, p_pairing);
    select count(*) filter (where status = 'approved'), bool_or(status = 'pending')
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

  if coalesce(v_approved, 0) >= 1 then
    raise exception 'This task has already been approved for your team.';
  end if;
  if coalesce(v_pending, false) then
    raise exception 'You already have a submission under review for this task.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pgpals_upload_reservation:' || v_team::text, 0)
  );
  if exists (
    select 1 from submission_upload_batches b
    where b.team_id = v_team
      and b.consumed_at is null
      and b.cancelled_at is null
      and b.expires_at > now()
  ) then
    raise exception 'Your team already has an upload in progress. Finish it or try again later.';
  end if;

  insert into submission_upload_batches (
    created_by, team_id, task_id, pairing_id, paths, content_types,
    declared_sizes, expires_at
  ) values (
    v_user, v_team, p_task, p_pairing, v_paths, v_content_types,
    v_declared_sizes, now() + interval '2 hours'
  ) returning id into v_batch_id;

  return query select v_batch_id, v_paths;
end $$;

revoke execute on function public.reserve_submission_uploads(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.reserve_submission_uploads(uuid, uuid, jsonb)
  to authenticated;

-- Without the legacy first/second-member foreign keys, protect every group
-- member equally and prevent deletions from leaving UUIDs behind in team_ids.
create or replace function public.guard_team_delete_with_pairings()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if exists (select 1 from pairings where old.id = any(team_ids)) then
    raise exception 'Delete this team''s group history before deleting the team.';
  end if;
  return old;
end $$;

create trigger teams_pairing_delete_guard
  before delete on public.teams
  for each row execute function public.guard_team_delete_with_pairings();

-- Remove the obsolete overload and indexes before dropping their source
-- columns. Historical migrations retain the upgrade path for existing data.
drop function if exists public.lock_pairing_scope(uuid, uuid, uuid);
drop index if exists public.pairings_task_status_team_a_idx;
drop index if exists public.pairings_task_status_team_b_idx;

alter table public.tasks drop column max_submissions;
alter table public.pairings
  drop column team_a,
  drop column team_b;
