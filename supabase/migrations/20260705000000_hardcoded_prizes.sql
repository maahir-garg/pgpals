-- Prize messaging is now hardcoded in src/lib/prizes.ts (top 8 tech prize
-- pool led by an iPad, confirmed monitors, Sony headphones, and projectors teaser,
-- AirPods lucky draw, finale reveal, and participation goodie bags) so the
-- pitch is identical on the landing page, leaderboard, and dashboard. The
-- editable column goes away.
alter table public.event_settings drop column prizes;

-- Real 2026 event window in SGT. The board-dark date defaults to around
-- 8 Sep, but admins can still adjust all three dates in Admin -> Settings.
-- Prize ceremony on 17 Sep is display copy in src/lib/prizes.ts.
update public.event_settings
set start_at = timestamptz '2026-08-31 00:00:00+08',
    end_at = timestamptz '2026-09-13 23:59:00+08',
    leaderboard_hide_at = timestamptz '2026-09-08 00:00:00+08'
where id = 1;
