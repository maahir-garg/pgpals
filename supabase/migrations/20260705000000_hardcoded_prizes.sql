-- Prize messaging is now hardcoded in src/lib/prizes.ts (top 8 tech prize
-- pool, confirmed iPads, monitors, AirPods, and projectors teaser, finale reveal,
-- and participation goodie bags) so the pitch is identical on the landing
-- page, leaderboard, and dashboard. The editable column goes away.
alter table public.event_settings drop column prizes;

-- Real 2026 event window: 31 Aug to 13 Sep, board dark for the final stretch,
-- prize ceremony on 17 Sep (ceremony date is copy in src/lib/prizes.ts).
-- Admins can still adjust these in Admin -> Settings.
update public.event_settings
set start_at = timestamptz '2026-08-31 00:00:00+08',
    end_at = timestamptz '2026-09-13 23:59:00+08',
    leaderboard_hide_at = timestamptz '2026-09-11 00:00:00+08'
where id = 1;
