-- ============================================================================
-- Last Call — backend schema for Supabase (Postgres)
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- players: one row per signed-in (anonymous) user. Holds public display info
-- and the stats we rank on the leaderboard. `id` matches the auth user id.
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default 'Anonymous',
  location    text,
  best_streak integer not null default 0,
  level       integer not null default 1,
  xp          integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- creations: cocktails players share to the community.
-- `recipe` is the full build (glass, method, garnish, ingredients) as JSON.
-- `like_count` is kept in sync by a trigger so we can sort cheaply.
-- ---------------------------------------------------------------------------
create table if not exists public.creations (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  name        text not null,
  recipe      jsonb not null,
  score       integer not null default 0,
  verdict     text,
  family      text,
  like_count  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists creations_like_count_idx on public.creations (like_count desc, created_at desc);
create index if not exists creations_created_idx on public.creations (created_at desc);

-- ---------------------------------------------------------------------------
-- likes: one row per (creation, player). The composite PK enforces one like
-- per player per creation.
-- ---------------------------------------------------------------------------
create table if not exists public.likes (
  creation_id uuid not null references public.creations (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (creation_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Keep creations.like_count accurate. SECURITY DEFINER so the trigger can
-- update the count regardless of who is liking (clients can't write it directly).
-- ---------------------------------------------------------------------------
create or replace function public.bump_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.creations set like_count = like_count + 1 where id = new.creation_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.creations set like_count = greatest(like_count - 1, 0) where id = old.creation_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_likes_count on public.likes;
create trigger trg_likes_count
  after insert or delete on public.likes
  for each row execute function public.bump_like_count();

-- ---------------------------------------------------------------------------
-- events: lightweight product analytics (screen views, stages played, shop
-- checkouts, etc.). Write-only from the client — there is no select policy,
-- so players can never read each other's activity. Query this yourself from
-- the Supabase SQL editor (the table owner / service role bypasses RLS).
-- `player_id` is nullable so events can be logged before a profile exists.
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  player_id  uuid references public.players (id) on delete set null,
  name       text not null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_name_idx on public.events (name);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.players   enable row level security;
alter table public.creations enable row level security;
alter table public.likes     enable row level security;
alter table public.events    enable row level security;

-- players: anyone can read; you can only insert/update your own row.
drop policy if exists players_select on public.players;
create policy players_select on public.players for select using (true);

drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert with check (auth.uid() = id);

drop policy if exists players_update on public.players;
create policy players_update on public.players for update using (auth.uid() = id) with check (auth.uid() = id);

-- creations: anyone can read; you can only create/delete your own.
drop policy if exists creations_select on public.creations;
create policy creations_select on public.creations for select using (true);

drop policy if exists creations_insert on public.creations;
create policy creations_insert on public.creations for insert with check (auth.uid() = player_id);

drop policy if exists creations_delete on public.creations;
create policy creations_delete on public.creations for delete using (auth.uid() = player_id);

-- likes: anyone can read; you can only add/remove your own like.
drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select using (true);

drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert with check (auth.uid() = player_id);

drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete using (auth.uid() = player_id);

-- events: anyone can insert (even pre-signup); nobody can select/update/delete
-- via the anon/authenticated roles, so this stays a private write-only log.
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert with check (true);

-- ============================================================================
-- Public leaderboard views (read-only, no personal data beyond display name).
-- ============================================================================
create or replace view public.leaderboard_likes as
  select c.id, c.name, c.score, c.verdict, c.family, c.like_count, c.created_at,
         p.name as player_name, p.location as player_location
  from public.creations c
  join public.players p on p.id = c.player_id
  order by c.like_count desc, c.created_at desc
  limit 100;

create or replace view public.leaderboard_streak as
  select p.id, p.name as player_name, p.location, p.best_streak, p.level
  from public.players p
  where p.best_streak > 0
  order by p.best_streak desc, p.level desc
  limit 100;

-- ============================================================================
-- Analytics helper view — a quick daily rollup of what players are doing.
-- Browse from the Supabase SQL editor, e.g.:
--   select * from public.analytics_daily order by day desc, count desc;
-- ============================================================================
create or replace view public.analytics_daily as
  select date_trunc('day', created_at) as day, name, count(*) as count
  from public.events
  group by 1, 2
  order by 1 desc, 3 desc;
