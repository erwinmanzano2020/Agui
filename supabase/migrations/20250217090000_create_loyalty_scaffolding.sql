-- Loyalty program scaffolding for alliances, guilds, and houses.
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'loyalty_scope'
      and n.nspname = 'public'
  ) then
    create type public.loyalty_scope as enum ('ALLIANCE', 'GUILD', 'HOUSE');
  end if;
end
$$;

create table if not exists public.loyalty_schemes (
  id uuid primary key default gen_random_uuid(),
  scope public.loyalty_scope not null,
  name text not null,
  precedence integer not null default 0,
  is_active boolean not null default true,
  allow_incognito boolean not null default false,
  design jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, name)
);

create table if not exists public.loyalty_profiles (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.loyalty_schemes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  account_no text not null unique,
  points integer not null default 0,
  tier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheme_id, entity_id)
);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_loyalty_schemes_updated_at
before update on public.loyalty_schemes
for each row
execute function public.touch_updated_at();

create trigger set_loyalty_profiles_updated_at
before update on public.loyalty_profiles
for each row
execute function public.touch_updated_at();
