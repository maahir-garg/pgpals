-- Removing an RA is a security-sensitive lifecycle operation, not just an
-- allowlist edit. Keep the allowlist, profile role, and Auth sessions in one
-- transaction so a removed admin cannot retain an authenticated admin session.

create or replace function public.demote_admin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_profile public.profiles%rowtype;
  v_was_allowlisted boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Enter an admin email.';
  end if;

  -- Serialize admin membership changes. Without this lock, two admins could
  -- concurrently observe two admins and demote each other, leaving none.
  perform pg_advisory_xact_lock(hashtextextended('pgpals_admin_membership', 0));

  select *
  into v_profile
  from public.profiles
  where email = v_email
  for update;

  if found and v_profile.role = 'admin' then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last signed-up admin.';
    end if;

    update public.profiles
    set role = 'participant'
    where id = v_profile.id;

    -- Deleting Auth sessions revokes refresh tokens through Auth's foreign-key
    -- cascade. getUser() also rejects the existing access token because its
    -- session_id no longer exists.
    delete from auth.sessions where user_id = v_profile.id;
  end if;

  delete from public.admin_allowlist
  where email = v_email
  returning true into v_was_allowlisted;

  if not found and v_profile.id is null then
    raise exception 'That email is not an admin or on the admin list.';
  end if;

  return jsonb_build_object(
    'demoted', v_profile.id is not null and v_profile.role = 'admin',
    'sessions_revoked', v_profile.id is not null and v_profile.role = 'admin',
    'allowlist_removed', coalesce(v_was_allowlisted, false)
  );
end;
$$;

revoke execute on function public.demote_admin(text) from public, anon;
grant execute on function public.demote_admin(text) to authenticated, service_role;
