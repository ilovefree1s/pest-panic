-- Pest Panic: add the House Mode leaderboard. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. Existing Survival scores are kept.
alter table public.leaderboard drop constraint if exists leaderboard_mode_check;
alter table public.leaderboard add constraint leaderboard_mode_check check (mode in ('solo', 'team', 'house'));
alter table public.leaderboard add column if not exists day smallint not null default 0 check (day between 0 and 999);
alter table public.leaderboard add column if not exists room smallint not null default 0 check (room between 0 and 3);
alter table public.leaderboard add column if not exists rooms smallint not null default 0 check (rooms between 0 and 4000);
create index if not exists leaderboard_house_rank on public.leaderboard (mode, rooms desc, seconds asc);
