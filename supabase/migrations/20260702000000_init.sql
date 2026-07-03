-- PGPals initial schema, RLS, and RPCs.
--
-- Security model: participants NEVER insert/update submissions or pairings
-- directly. All sensitive writes go through SECURITY DEFINER functions that
-- re-check every event rule (release window, deadline, team membership,
-- pairing validity, max submissions). RLS handles reads. The leaderboard is
-- only reachable through an RPC that enforces the hide date server-side.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  room_no text,
  role text not null default 'participant' check (role in ('participant', 'admin')),
  team_id uuid references public.teams (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Pre-assigned membership list, imported from CSV by admins. Signup is only
-- allowed for emails on this roster (or an allowed domain in event_settings).
create table public.roster (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  points int not null check (points >= 0),
  type text not null default 'standard' check (type in ('standard', 'pair')),
  release_at timestamptz not null,
  deadline_at timestamptz not null check (deadline_at > release_at),
  -- {"kind":"first_n","n":10,"bonus":5}
  -- {"kind":"before","cutoff":"2026-07-10T04:00:00Z","bonus":10}
  -- {"kind":"multiplier_before","cutoff":"2026-07-10T04:00:00Z","multiplier":1.5}
  bonus_config jsonb,
  max_submissions int not null default 1 check (max_submissions >= 1),
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  team_a uuid not null references public.teams (id) on delete cascade,
  team_b uuid not null references public.teams (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_by_team uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (team_a <> team_b)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  pairing_id uuid references public.pairings (id) on delete set null,
  text_content text not null default '',
  photo_paths text[] not null default '{}',
  -- 'superseded' = a rejected submission that was replaced by a resubmission
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  points_awarded int,
  reviewer_id uuid references public.profiles (id) on delete set null,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resubmission_of uuid references public.submissions (id) on delete set null
);

create table public.bonus_awards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  points int not null,
  reason text not null,
  awarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_settings (
  id int primary key default 1 check (id = 1),
  event_name text not null default 'PGPals',
  start_at timestamptz not null,
  end_at timestamptz not null,
  leaderboard_hide_at timestamptz not null,
  allowed_email_domains text[] not null default '{}'
);

insert into public.event_settings (id, start_at, end_at, leaderboard_hide_at)
values (1, now(), now() + interval '14 days', now() + interval '11 days');

-- Emails allowed to become admins at signup (bootstrap for the first admin:
-- add your email here via the SQL editor, then sign up in the app).
create table public.admin_allowlist (
  email text primary key check (email = lower(email))
);

create index submissions_task_idx on public.submissions (task_id);
create index submissions_team_idx on public.submissions (team_id);
create index submissions_pending_idx on public.submissions (status) where status = 'pending';
create index pairings_task_idx on public.pairings (task_id);
create index roster_team_idx on public.roster (team_id);
create index profiles_team_idx on public.profiles (team_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies can use them without
-- recursing into the tables they protect)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.my_team_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as
$$ select team_id from profiles where id = auth.uid() $$;

create or replace function public.pairing_involves_me(p_pairing uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as
$$ select exists (
     select 1 from pairings
     where id = p_pairing and (team_a = my_team_id() or team_b = my_team_id())
   ) $$;

-- True when called with the service role key or from a SECURITY DEFINER
-- function chain started by it (used to let triggers wave through seed/admin
-- API operations that no browser client can perform).
create or replace function public.is_service_role()
returns boolean language sql stable set search_path = public, pg_temp as
$$ select coalesce(auth.jwt() ->> 'role', current_user) in ('service_role', 'postgres', 'supabase_admin') $$;

-- ---------------------------------------------------------------------------
-- Signup: reject emails that aren't on the roster (or an allowed domain),
-- auto-link the profile to the pre-assigned team.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text := lower(new.email);
  v_roster roster%rowtype;
  v_domains text[];
begin
  -- Pre-authorized admin emails (see admin_allowlist).
  if exists (select 1 from admin_allowlist where email = v_email) then
    insert into profiles (id, full_name, email, role)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(v_email, '@', 1)), v_email, 'admin');
    return new;
  end if;

  select * into v_roster from roster where email = v_email;
  if found then
    insert into profiles (id, full_name, email, team_id)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_roster.full_name), v_email, v_roster.team_id);
    return new;
  end if;

  select allowed_email_domains into v_domains from event_settings where id = 1;
  if v_domains @> array[split_part(v_email, '@', 2)] then
    insert into profiles (id, full_name, email)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(v_email, '@', 1)), v_email);
    return new;
  end if;

  raise exception 'This email is not registered for PGPals. Ask your RA to add you to a team.';
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Friendly pre-check for the signup form (callable before an account exists).
create or replace function public.signup_precheck(p_email text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_email text := lower(trim(p_email));
  v_roster roster%rowtype;
  v_domains text[];
begin
  if exists (select 1 from profiles where email = v_email) then
    return jsonb_build_object('ok', false, 'reason', 'already_registered');
  end if;
  if exists (select 1 from admin_allowlist where email = v_email) then
    return jsonb_build_object('ok', true, 'full_name', null, 'team_name', null);
  end if;
  select * into v_roster from roster where email = v_email;
  if found then
    return jsonb_build_object('ok', true, 'full_name', v_roster.full_name,
      'team_name', (select name from teams where id = v_roster.team_id));
  end if;
  select allowed_email_domains into v_domains from event_settings where id = 1;
  if v_domains @> array[split_part(v_email, '@', 2)] then
    return jsonb_build_object('ok', true, 'full_name', null, 'team_name', null);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'not_on_roster');
end $$;

-- ---------------------------------------------------------------------------
-- Update guards: participants can only rename their own team and edit their
-- own name/room; role/team/email changes are admin-only.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if is_service_role() or is_admin() then return new; end if;
  if new.role is distinct from old.role
     or new.team_id is distinct from old.team_id
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Only admins can change role, team or email.';
  end if;
  return new;
end $$;

create trigger profiles_update_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_team_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if is_service_role() or is_admin() then return new; end if;
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Only admins can change team fields other than the name.';
  end if;
  return new;
end $$;

create trigger teams_update_guard
  before update on public.teams
  for each row execute function public.guard_team_update();

-- ---------------------------------------------------------------------------
-- Scoring
-- ---------------------------------------------------------------------------

-- Team total = approved submissions where the team submitted or is a partner
-- in the pairing, + manual bonus awards. Computed live: at this event's scale
-- (a few thousand rows) it is instant and can never drift.
create or replace function public.team_score(p_team uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
      select sum(s.points_awarded)
      from submissions s
      left join pairings p on p.id = s.pairing_id
      where s.status = 'approved'
        and (s.team_id = p_team or p.team_a = p_team or p.team_b = p_team)
    ), 0)
    + coalesce((select sum(points) from bonus_awards where team_id = p_team), 0);
$$;

-- Not directly callable: only via the RPCs below, so scores can't be
-- reconstructed after the leaderboard hide date.
revoke execute on function public.team_score(uuid) from public, anon, authenticated;

create or replace function public.get_my_score()
returns int language sql stable security definer set search_path = public, pg_temp as
$$ select public.team_score(my_team_id()) $$;

-- Leaderboard. Returns nothing for participants after leaderboard_hide_at;
-- admins always see it. Ties: whoever reached their score first ranks higher.
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
    with last_scored as (
      select t.id,
        greatest(
          (select max(s.reviewed_at) from submissions s
             left join pairings p on p.id = s.pairing_id
             where s.status = 'approved'
               and (s.team_id = t.id or p.team_a = t.id or p.team_b = t.id)),
          (select max(b.created_at) from bonus_awards b where b.team_id = t.id)
        ) as at
      from teams t
    )
    select t.id, t.name, public.team_score(t.id),
      rank() over (order by public.team_score(t.id) desc, ls.at asc nulls last, t.name asc),
      t.id = my_team_id()
    from teams t
    join last_scored ls on ls.id = t.id;
end $$;

-- ---------------------------------------------------------------------------
-- Submissions (participants may ONLY create through this RPC)
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

  -- Link to the latest rejected attempt and mark old rejections superseded.
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

-- ---------------------------------------------------------------------------
-- Pairings (RPC-only writes)
-- ---------------------------------------------------------------------------

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
  if p_accept and exists (select 1 from pairings
      where task_id = v_pairing.task_id and status = 'accepted' and id <> p_pairing
        and (team_a in (v_pairing.team_a, v_pairing.team_b) or team_b in (v_pairing.team_a, v_pairing.team_b))) then
    raise exception 'One of the teams has already paired up for this task.';
  end if;
  update pairings set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_pairing;
end $$;

create or replace function public.cancel_pair_invite(p_pairing uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_team uuid := my_team_id();
  v_pairing pairings%rowtype;
begin
  select * into v_pairing from pairings where id = p_pairing for update;
  if not found or v_pairing.status <> 'pending' or v_pairing.created_by_team <> v_team then
    raise exception 'Only the inviting team can cancel a pending invite.';
  end if;
  delete from pairings where id = p_pairing;
end $$;

-- Teams still available to pair with for a task (no pending/accepted pairing).
create or replace function public.available_partner_teams(p_task uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, t.name from teams t
  where t.id <> my_team_id()
    and not exists (
      select 1 from pairings p
      where p.task_id = p_task and p.status in ('pending', 'accepted')
        and (p.team_a = t.id or p.team_b = t.id)
    )
  order by t.name;
$$;

-- ---------------------------------------------------------------------------
-- Review (admin-only RPC; computes bonus points server-side)
-- ---------------------------------------------------------------------------

create or replace function public.compute_award(p_task tasks, p_submission submissions)
returns int language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_kind text := p_task.bonus_config ->> 'kind';
  v_base int := p_task.points;
  v_prior_approved int;
begin
  if v_kind is null then return v_base; end if;
  if v_kind = 'first_n' then
    select count(*) into v_prior_approved from submissions
      where task_id = p_task.id and status = 'approved' and id <> p_submission.id;
    if v_prior_approved < (p_task.bonus_config ->> 'n')::int then
      return v_base + (p_task.bonus_config ->> 'bonus')::int;
    end if;
    return v_base;
  elsif v_kind = 'before' then
    if p_submission.submitted_at <= (p_task.bonus_config ->> 'cutoff')::timestamptz then
      return v_base + (p_task.bonus_config ->> 'bonus')::int;
    end if;
    return v_base;
  elsif v_kind = 'multiplier_before' then
    if p_submission.submitted_at <= (p_task.bonus_config ->> 'cutoff')::timestamptz then
      return round(v_base * (p_task.bonus_config ->> 'multiplier')::numeric)::int;
    end if;
    return v_base;
  end if;
  return v_base;
end $$;

revoke execute on function public.compute_award(tasks, submissions) from public, anon, authenticated;

create or replace function public.review_submission(
  p_submission uuid,
  p_approve boolean,
  p_note text default null,
  p_points_override int default null
) returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_submission submissions%rowtype;
  v_task tasks%rowtype;
  v_points int;
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  select * into v_submission from submissions where id = p_submission for update;
  if not found or v_submission.status <> 'pending' then
    raise exception 'Submission not found or already reviewed.';
  end if;
  if p_approve then
    select * into v_task from tasks where id = v_submission.task_id;
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

-- Undo a review (admin mistake recovery): back to pending.
create or replace function public.revert_review(p_submission uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  update submissions
    set status = 'pending', points_awarded = null, reviewer_id = null,
        review_note = null, reviewed_at = null
    where id = p_submission and status in ('approved', 'rejected');
  if not found then raise exception 'Submission not found or not reviewed.'; end if;
end $$;

-- What the points would be if approved right now (shown in the review UI).
create or replace function public.preview_award(p_submission uuid)
returns int language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_submission submissions%rowtype;
  v_task tasks%rowtype;
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  select * into v_submission from submissions where id = p_submission;
  select * into v_task from tasks where id = v_submission.task_id;
  return compute_award(v_task, v_submission);
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.roster enable row level security;
alter table public.tasks enable row level security;
alter table public.pairings enable row level security;
alter table public.submissions enable row level security;
alter table public.bonus_awards enable row level security;
alter table public.announcements enable row level security;
alter table public.event_settings enable row level security;

-- teams: names are visible to all logged-in users (needed for partner picker);
-- members may rename their own team (update guard restricts to name only).
create policy teams_select on public.teams for select to authenticated using (true);
create policy teams_update on public.teams for update to authenticated
  using (id = my_team_id() or is_admin());
create policy teams_insert on public.teams for insert to authenticated with check (is_admin());
create policy teams_delete on public.teams for delete to authenticated using (is_admin());

-- profiles: self + teammates + admins.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (team_id is not null and team_id = my_team_id()) or is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or is_admin());

alter table public.admin_allowlist enable row level security;
create policy admin_allowlist_all on public.admin_allowlist for all to authenticated
  using (is_admin()) with check (is_admin());

-- roster: own team's entries (to show a partner who hasn't signed up) + admins.
create policy roster_select on public.roster for select to authenticated
  using (team_id = my_team_id() or is_admin());
create policy roster_write on public.roster for all to authenticated
  using (is_admin()) with check (is_admin());

-- tasks: participants only see published tasks past their release time
-- (closed tasks stay visible); admins see everything.
create policy tasks_select on public.tasks for select to authenticated
  using (is_admin() or (is_published and release_at <= now()));
create policy tasks_write_insert on public.tasks for insert to authenticated with check (is_admin());
create policy tasks_write_update on public.tasks for update to authenticated using (is_admin());
create policy tasks_write_delete on public.tasks for delete to authenticated using (is_admin());

-- pairings: read if involved; all writes via RPCs.
create policy pairings_select on public.pairings for select to authenticated
  using (is_admin() or team_a = my_team_id() or team_b = my_team_id());
create policy pairings_admin_write on public.pairings for all to authenticated
  using (is_admin()) with check (is_admin());

-- submissions: read own team's + joint pair submissions; no direct writes for
-- participants (create_submission / review_submission RPCs only).
create policy submissions_select on public.submissions for select to authenticated
  using (is_admin() or team_id = my_team_id()
         or (pairing_id is not null and pairing_involves_me(pairing_id)));
create policy submissions_admin_write on public.submissions for all to authenticated
  using (is_admin()) with check (is_admin());

-- bonus awards: teams see their own (with reason), admins manage.
create policy bonus_select on public.bonus_awards for select to authenticated
  using (team_id = my_team_id() or is_admin());
create policy bonus_write on public.bonus_awards for all to authenticated
  using (is_admin()) with check (is_admin());

-- announcements: everyone reads, admins write.
create policy announcements_select on public.announcements for select to authenticated using (true);
create policy announcements_write on public.announcements for all to authenticated
  using (is_admin()) with check (is_admin());

-- event settings: everyone reads (event name/dates power the UI; the
-- leaderboard hide is enforced by get_leaderboard, not by hiding this row).
create policy settings_select on public.event_settings for select to authenticated using (true);
create policy settings_update on public.event_settings for update to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- Storage: submission photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

-- Participants upload only into their own team's folder.
create policy submissions_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = my_team_id()::text);

-- Direct reads: own team + admins. (Pair partners and the review UI use
-- short-lived signed URLs generated server-side after an RLS-checked read of
-- the submission row.)
create policy submissions_read on storage.objects for select to authenticated
  using (bucket_id = 'submissions'
         and ((storage.foldername(name))[1] = my_team_id()::text or is_admin()));

-- ---------------------------------------------------------------------------
-- Grants. Hosted Supabase sets default privileges for these roles; local CLI
-- migrations may not, so grant explicitly to keep both environments identical.
-- RLS (above) is what actually limits what authenticated users can touch.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.signup_precheck(text) to anon, authenticated;

-- Re-assert: score functions are only reachable via the wrapped RPCs, so the
-- leaderboard cannot be reconstructed after the hide date.
revoke execute on function public.team_score(uuid) from public, anon, authenticated;
revoke execute on function public.compute_award(tasks, submissions) from public, anon, authenticated;
