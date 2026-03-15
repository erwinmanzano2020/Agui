-- RPG taxonomy foundations: entities, guilds, houses, parties, and scoped roles.

create extension if not exists "pgcrypto";

-- Base entities represent people, organizations, or systems that can hold roles.
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Identifier types for unique contact handles.
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

create table if not exists public.entity_identifiers (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  identifier_type public.entity_identifier_type not null,
  identifier_value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Ensure uniqueness for email and phone identifiers across all entities.
create unique index if not exists entity_identifiers_email_unique
  on public.entity_identifiers (lower(identifier_value))
  where identifier_type = 'EMAIL';

create unique index if not exists entity_identifiers_phone_unique
  on public.entity_identifiers (identifier_value)
  where identifier_type = 'PHONE';

create unique index if not exists entity_identifiers_primary_unique
  on public.entity_identifiers (entity_id, identifier_type)
  where is_primary;

-- Alliances group multiple guilds under a shared banner.
create table if not exists public.alliances (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  motto text,
  crest jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guild_types (
  code text primary key,
  label text not null,
  description text
);

insert into public.guild_types (code, label, description) values
  ('MERCHANT', 'Merchant Guild', 'Commerce-first guild focused on trade and retail operations.'),
  ('ADVENTURER', 'Adventurer Guild', 'Questing, contracting, and operations for mobile crews.'),
  ('APOTHECARY', 'Apothecary Guild', 'Health, wellness, and potion-making collectives.')
on conflict (code) do update
  set label = excluded.label,
      description = excluded.description;

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references public.entities(id) on delete set null,
  slug text not null unique,
  name text not null,
  guild_type text not null references public.guild_types(code),
  motto text,
  profile jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  modules jsonb not null default '{}'::jsonb,
  payroll jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alliance_guilds (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (alliance_id, guild_id)
);

create table if not exists public.alliance_roles (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.entities(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (alliance_id, entity_id, role)
);

create table if not exists public.guild_roles (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.entities(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (guild_id, entity_id, role)
);

create table if not exists public.house_types (
  code text primary key,
  label text not null,
  description text
);

insert into public.house_types (code, label, description) values
  ('RETAIL', 'Retail House', 'Front-of-house operations for stores and stalls.'),
  ('MANUFACTURER', 'Manufacturer House', 'Production, fabrication, and workshop operations.'),
  ('BRAND', 'Brand House', 'Marketing, identity, and franchise guardians.'),
  ('SERVICE', 'Service House', 'On-demand services, crews, and scheduling.'),
  ('WHOLESALE', 'Wholesale House', 'Bulk trade, logistics, and distribution hubs.'),
  ('DISTRIBUTOR', 'Distributor House', 'Regional distribution and fulfillment teams.')
on conflict (code) do update
  set label = excluded.label,
      description = excluded.description;

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  house_type text not null references public.house_types(code),
  slug text,
  name text not null,
  motto text,
  crest jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists houses_guild_slug_unique
  on public.houses (guild_id, slug)
  where slug is not null;

create table if not exists public.house_roles (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.entities(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (house_id, entity_id, role)
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid references public.guilds(id) on delete set null,
  house_id uuid references public.houses(id) on delete set null,
  slug text,
  name text not null,
  purpose text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guild_id is not null or house_id is not null)
);

create unique index if not exists parties_guild_slug_unique
  on public.parties (guild_id, slug)
  where guild_id is not null and slug is not null;

create unique index if not exists parties_house_slug_unique
  on public.parties (house_id, slug)
  where house_id is not null and slug is not null;

create table if not exists public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text,
  joined_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (party_id, entity_id)
);

-- Compatibility view to surface legacy orgs as guild projections.
create or replace view public.orgs_as_guilds as
with resolved_guilds as (
  select
    g.id,
    g.name,
    g.slug,
    g.guild_type,
    g.theme,
    g.modules,
    g.payroll,
    g.profile,
    g.metadata,
    g.entity_id,
    g.motto,
    g.created_at,
    g.updated_at,
    'guilds'::text as source
  from public.guilds g
  union all
  select
    o.id,
    o.name,
    o.slug,
    'MERCHANT'::text as guild_type,
    coalesce(o.theme, '{}'::jsonb) as theme,
    coalesce(o.modules, '{}'::jsonb) as modules,
    coalesce(o.payroll, '{}'::jsonb) as payroll,
    '{}'::jsonb as profile,
    jsonb_build_object('legacy_org', true) as metadata,
    null::uuid as entity_id,
    null::text as motto,
    o.created_at,
    o.created_at as updated_at,
    'orgs'::text as source
  from public.orgs o
  where not exists (
    select 1 from public.guilds g2 where g2.slug = o.slug
  )
)
select * from resolved_guilds;
