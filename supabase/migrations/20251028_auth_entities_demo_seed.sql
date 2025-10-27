create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'entity_identifier_type'
      and n.nspname = 'public'
  ) then
    create type public.entity_identifier_type as enum ('EMAIL', 'PHONE');
  end if;
end
$$;

-- Ensure entity scaffolding exists for auth bootstrap
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_identifiers (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  identifier_type public.entity_identifier_type not null,
  identifier_value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists entity_identifiers_unique_value
  on public.entity_identifiers (identifier_type, identifier_value);

create unique index if not exists entity_identifiers_primary_unique
  on public.entity_identifiers (entity_id, identifier_type)
  where is_primary;

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  guild_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  slug text unique not null,
  name text not null,
  house_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_seed_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists demo_seed_runs_user_unique
  on public.demo_seed_runs (user_id);
