-- Signup is roster-only: a resident's email must be on a team roster, and an
-- RA's email must be in admin_allowlist (managed in Admin -> Settings). The
-- allowed-email-domains escape hatch (team-less signups) is removed, which
-- also removes the only path that created profiles without a team.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text := lower(new.email);
  v_roster roster%rowtype;
begin
  -- RA emails (see admin_allowlist, managed in Admin -> Settings).
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

  raise exception 'This email is not registered for PGPals. Ask your RA to add you to a team.';
end $$;

create or replace function public.signup_precheck(p_email text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_email text := lower(trim(p_email));
  v_roster roster%rowtype;
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
  return jsonb_build_object('ok', false, 'reason', 'not_on_roster');
end $$;

alter table public.event_settings drop column allowed_email_domains;
