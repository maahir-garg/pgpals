-- team_ids became the authoritative group membership list in the multi-team
-- migration. Keep read authorization on the same source of truth so the third
-- through twentieth invited teams can load and respond to their invitation.

drop policy if exists pairings_select on public.pairings;
create policy pairings_select on public.pairings
  for select
  to authenticated
  using (public.is_admin() or public.my_team_id() = any(team_ids));
