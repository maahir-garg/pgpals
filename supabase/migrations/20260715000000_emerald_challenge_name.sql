-- Rename the existing event while preserving any custom admin-set name.
alter table public.event_settings
  alter column event_name set default 'PGPals: The Emerald Challenge';

update public.event_settings
set event_name = 'PGPals: The Emerald Challenge'
where event_name = 'PGPals';
