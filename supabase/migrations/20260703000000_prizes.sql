-- Prize list shown to residents (landing page prize spotlight and the
-- leaderboard banner). Markdown-lite text edited in Admin -> Settings;
-- empty string means the UI falls back to generic "exciting prizes" copy.
alter table public.event_settings add column prizes text not null default '';
