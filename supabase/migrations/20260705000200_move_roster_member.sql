-- Regrouping: move a rostered resident to another team in one transaction
-- (roster entry plus their profile if they already signed up). Submissions
-- and coins stay with the old team; scores are computed from team_id on the
-- submission rows, so history never moves with the person.
create or replace function public.move_roster_member(p_roster uuid, p_team uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_entry roster%rowtype;
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  select * into v_entry from roster where id = p_roster for update;
  if not found then raise exception 'Roster entry not found.'; end if;
  if v_entry.team_id = p_team then
    raise exception 'They are already on that team.';
  end if;
  if not exists (select 1 from teams where id = p_team) then
    raise exception 'Destination team not found.';
  end if;
  update roster set team_id = p_team where id = p_roster;
  update profiles set team_id = p_team where email = v_entry.email;
end $$;
