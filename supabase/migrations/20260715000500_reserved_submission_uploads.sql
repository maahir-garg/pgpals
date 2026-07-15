-- Participant media uploads are reservation-only. The browser cannot insert
-- arbitrary objects with its JWT: an authenticated RPC validates the task and
-- file budget, generates fixed paths, and the app server issues signed upload
-- tokens for only those paths. Submission finalization verifies the real
-- Storage metadata and consumes the matching reservation atomically.

create table public.submission_upload_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  pairing_id uuid references public.pairings (id) on delete cascade,
  paths text[] not null,
  content_types text[] not null,
  declared_sizes bigint[] not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  consumed_at timestamptz,
  cancelled_at timestamptz,
  check (cardinality(paths) between 1 and 5),
  check (cardinality(paths) = cardinality(content_types)),
  check (cardinality(paths) = cardinality(declared_sizes)),
  check (array_position(paths, null) is null),
  check (array_position(content_types, null) is null),
  check (array_position(declared_sizes, null) is null)
);

create index submission_upload_batches_live_team_idx
  on public.submission_upload_batches (team_id, expires_at)
  where consumed_at is null and cancelled_at is null;

alter table public.submission_upload_batches enable row level security;
revoke all on table public.submission_upload_batches from public, anon, authenticated;
grant all on table public.submission_upload_batches to service_role;

-- Direct browser uploads are intentionally disabled. Signed upload tokens are
-- created by the app server only after reserve_submission_uploads succeeds.
drop policy if exists submissions_upload on storage.objects;

create or replace function public.valid_submission_attachments(p_paths text[])
returns boolean
language sql immutable strict set search_path = public, pg_temp as $$
  select cardinality(p_paths) between 1 and 5
    and cardinality(p_paths) = (
      select count(distinct path) from unnest(p_paths) as attachment(path)
    )
    and not exists (
      select 1
      from unnest(p_paths) as attachment(path)
      where lower(path) !~ '\.(jpg|jpeg|png|webp|mp4|mov|webm)$'
    )
    and (
      select count(*)
      from unnest(p_paths) as attachment(path)
      where lower(path) ~ '\.(mp4|mov|webm)$'
    ) <= 3;
$$;

revoke execute on function public.valid_submission_attachments(text[])
  from public, anon, authenticated;
grant execute on function public.valid_submission_attachments(text[])
  to service_role;

create function public.reserve_submission_uploads(
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
  v_index int;
  v_content_type text;
  v_extension text;
  v_size bigint;
  v_video_count int := 0;
  v_video_bytes bigint := 0;
  v_folder uuid := gen_random_uuid();
  v_paths text[] := '{}';
  v_content_types text[] := '{}';
  v_declared_sizes bigint[] := '{}';
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

create or replace function public.guard_submission_attachments()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_object_count int;
  v_video_bytes bigint;
  v_types_match boolean;
  v_sizes_valid boolean;
  v_batch submission_upload_batches%rowtype;
begin
  if not public.valid_submission_attachments(new.photo_paths) then
    raise exception 'Attach 1 to 5 supported files, with no more than 3 videos.';
  end if;

  select count(*),
         coalesce(sum(
           case when lower(name) ~ '\.(mp4|mov|webm)$'
             then coalesce((metadata ->> 'size')::bigint, 0)
             else 0
           end
         ), 0),
         coalesce(bool_and(
           case
             when lower(name) ~ '\.(jpg|jpeg)$'
               then lower(metadata ->> 'mimetype') = 'image/jpeg'
             when lower(name) ~ '\.png$'
               then lower(metadata ->> 'mimetype') = 'image/png'
             when lower(name) ~ '\.webp$'
               then lower(metadata ->> 'mimetype') = 'image/webp'
             when lower(name) ~ '\.mp4$'
               then lower(metadata ->> 'mimetype') = 'video/mp4'
             when lower(name) ~ '\.mov$'
               then lower(metadata ->> 'mimetype') = 'video/quicktime'
             when lower(name) ~ '\.webm$'
               then lower(metadata ->> 'mimetype') = 'video/webm'
             else false
           end
         ), false)
    into v_object_count, v_video_bytes, v_types_match
  from storage.objects
  where bucket_id = 'submissions'
    and name = any(new.photo_paths);

  if v_object_count <> cardinality(new.photo_paths) then
    raise exception 'Upload every attachment before submitting.';
  end if;
  if not v_types_match then
    raise exception 'An uploaded attachment does not match its reserved file type.';
  end if;
  if v_video_bytes > 104857600 then
    raise exception 'Videos can total at most 100 MB per submission.';
  end if;

  -- Seed/service operations and explicit admin maintenance may insert directly.
  -- Participant submissions must consume one exact, unexpired reservation.
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;

  select b.* into v_batch
  from submission_upload_batches b
  where b.created_by = auth.uid()
    and b.team_id = new.team_id
    and b.task_id = new.task_id
    and b.pairing_id is not distinct from new.pairing_id
    and b.paths = new.photo_paths
    and b.consumed_at is null
    and b.cancelled_at is null
    and b.expires_at > now()
  limit 1
  for update;

  if not found then
    raise exception 'These uploads were not reserved or the upload window expired.';
  end if;

  select coalesce(bool_and(
           coalesce((o.metadata ->> 'size')::bigint, 0) between 1 and expected.declared_size
           and lower(o.metadata ->> 'mimetype') = expected.content_type
         ), false)
    into v_sizes_valid
  from unnest(v_batch.paths, v_batch.content_types, v_batch.declared_sizes)
       as expected(path, content_type, declared_size)
  join storage.objects o
    on o.bucket_id = 'submissions' and o.name = expected.path;

  if not v_sizes_valid then
    raise exception 'An uploaded attachment exceeds its reservation.';
  end if;

  update submission_upload_batches
  set consumed_at = now()
  where id = v_batch.id;

  return new;
end $$;

revoke execute on function public.guard_submission_attachments()
  from public, anon, authenticated;
grant execute on function public.guard_submission_attachments() to service_role;
