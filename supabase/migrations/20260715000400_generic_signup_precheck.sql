-- The public signup precheck is deliberately non-enumerating. Eligibility and
-- account existence are enforced later by Auth plus handle_new_user(); callers
-- must not be able to probe roster names, teams, admin emails, or signup state.

create or replace function public.signup_precheck(p_email text)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object('ok', true);
$$;

grant execute on function public.signup_precheck(text) to anon, authenticated;
