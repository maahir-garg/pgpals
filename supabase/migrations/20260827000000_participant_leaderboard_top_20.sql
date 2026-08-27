-- Keep the participant leaderboard concise without exposing every lower-ranked
-- team through the RPC. Admins retain the complete result for event operations.
create or replace function public.get_leaderboard()
returns table (team_id uuid, team_name text, points int, rank bigint, is_mine boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_hide timestamptz;
  v_is_admin boolean := is_admin();
  v_team uuid := my_team_id();
begin
  select leaderboard_hide_at into v_hide from event_settings where id = 1;
  if not v_is_admin and now() >= v_hide then
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
        select s.team_id
        union
        select unnest(coalesce(p.team_ids, '{}'))
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
    select r.id, r.name, r.points, r.rank, r.id = v_team
    from ranked r
    where v_is_admin or r.rank <= 20 or r.id = v_team
    order by r.rank, r.name;
end $$;
