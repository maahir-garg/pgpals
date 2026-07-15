-- Allow mixed photo/video submission proof while keeping event-scale storage
-- bounded. `photo_paths` is retained as the compatibility column name.

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ]
where id = 'submissions';

create function public.valid_submission_attachments(p_paths text[])
returns boolean
language sql immutable strict set search_path = public, pg_temp as $$
  select cardinality(p_paths) between 1 and 5
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

alter table public.submissions
  add constraint submissions_valid_attachments
  check (public.valid_submission_attachments(photo_paths));

create function public.guard_submission_attachments()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_object_count int;
  v_video_bytes bigint;
begin
  if not public.valid_submission_attachments(new.photo_paths) then
    raise exception 'Attach 1 to 5 supported files, with no more than 3 videos.';
  end if;

  select count(*),
         coalesce(sum(
           case
             when lower(name) ~ '\.(mp4|mov|webm)$'
               then (metadata ->> 'size')::bigint
             else 0
           end
         ), 0)
    into v_object_count, v_video_bytes
  from storage.objects
  where bucket_id = 'submissions'
    and name = any(new.photo_paths);

  if v_object_count <> cardinality(new.photo_paths) then
    raise exception 'Upload every attachment before submitting.';
  end if;
  if v_video_bytes > 104857600 then
    raise exception 'Videos can total at most 100 MB per submission.';
  end if;
  return new;
end $$;

create trigger submissions_attachment_guard
  before insert or update of photo_paths on public.submissions
  for each row execute function public.guard_submission_attachments();
