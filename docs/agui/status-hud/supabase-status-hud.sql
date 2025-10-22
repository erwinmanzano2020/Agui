-- Status HUD Supabase schema and helpers
-- Run this script inside the Supabase SQL editor.

-- User progression stats per profile
create table if not exists public.user_stats (
    user_id uuid primary key references auth.users(id) on delete cascade,
    xp integer not null default 0 check (xp >= 0),
    level integer not null default 1 check (level >= 1),
    coins integer not null default 0 check (coins >= 0),
    updated_at timestamptz not null default now()
);

comment on table public.user_stats is 'Aggregated XP, level, and coin balances per user for the Status HUD.';
comment on column public.user_stats.xp is 'Lifetime experience points.';
comment on column public.user_stats.level is 'Derived level (1 + floor(xp / 500)).';
comment on column public.user_stats.coins is 'Spendable in-game currency earned from quests.';

-- Quest catalog
create table if not exists public.quests (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    description text,
    xp_reward integer not null default 0 check (xp_reward >= 0),
    coin_reward integer not null default 0 check (coin_reward >= 0),
    is_daily boolean not null default false,
    created_at timestamptz not null default now()
);

comment on table public.quests is 'List of available quests for the Status HUD experience system.';

-- User quest progress
create table if not exists public.user_quests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    quest_id uuid not null references public.quests(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending','active','completed','claimed')),
    progress integer not null default 0 check (progress >= 0),
    goal integer not null default 1 check (goal > 0),
    last_completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, quest_id)
);

comment on table public.user_quests is 'Tracks quest enrollment and completion state per user.';

create or replace function public.set_user_quests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_quests_set_updated_at
before update on public.user_quests
for each row execute procedure public.set_user_quests_updated_at();

-- Seed baseline quests (idempotent)
insert into public.quests (slug, name, description, xp_reward, coin_reward, is_daily)
values
  ('check-in', 'Daily Check-in', 'Open Agui Status HUD for the day.', 100, 10, true),
  ('complete-shift', 'Complete a Shift', 'Log an entire shift without absences.', 250, 25, false),
  ('share-feedback', 'Share Feedback', 'Submit feedback to improve Agui.', 150, 15, false)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    xp_reward = excluded.xp_reward,
    coin_reward = excluded.coin_reward,
    is_daily = excluded.is_daily;

-- Reward helper: add XP & coins and recompute level (every 500 XP)
create or replace function public.grant_rewards(
  p_user_id uuid,
  p_xp integer default 0,
  p_coins integer default 0
) returns public.user_stats
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_stats public.user_stats;
  v_level integer;
begin
  if p_user_id is null then
    raise exception 'grant_rewards requires a user id';
  end if;

  insert into public.user_stats as us (user_id, xp, coins, level)
  values (p_user_id, greatest(p_xp, 0), greatest(p_coins, 0), 1)
  on conflict (user_id) do update
    set xp = us.xp + greatest(p_xp, 0),
        coins = us.coins + greatest(p_coins, 0),
        updated_at = now()
  returning * into v_stats;

  v_level := floor(v_stats.xp / 500)::int + 1;

  if v_level <> v_stats.level then
    update public.user_stats
    set level = v_level,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_stats;
  end if;

  return v_stats;
end;
$$;

comment on function public.grant_rewards(uuid, integer, integer) is 'RPC helper to add XP/coins and automatically level up every 500 XP.';
