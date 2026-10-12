-- Pest Panic leaderboard. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60),
  mode text not null check (mode in ('solo', 'team')),
  players smallint not null check (players between 1 and 4),
  seconds integer not null check (seconds between 30 and 86400),
  kills integer not null default 0 check (kills >= 0),
  level smallint not null default 1 check (level >= 1),
  bosses smallint not null default 0 check (bosses >= 0)
);
create index if not exists leaderboard_mode_seconds on public.leaderboard (mode, seconds desc);

alter table public.leaderboard enable row level security;
drop policy if exists "anyone can read the leaderboard" on public.leaderboard;
create policy "anyone can read the leaderboard" on public.leaderboard for select to anon, authenticated using (true);
drop policy if exists "anyone can add a score" on public.leaderboard;
create policy "anyone can add a score" on public.leaderboard for insert to anon, authenticated with check (true);
grant select, insert on public.leaderboard to anon, authenticated;
