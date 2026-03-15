create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.entities
  alter column display_name set not null;

alter table if exists public.entities
  add column if not exists profile jsonb not null default '{}'::jsonb;

alter table if exists public.entities
  add column if not exists updated_at timestamptz not null default now();

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

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'kind'
  ) then
    alter table public.entity_identifiers rename column kind to identifier_type_text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'value'
  ) then
    alter table public.entity_identifiers rename column value to identifier_value;
  end if;
end
$$;

alter table if exists public.entity_identifiers
  add column if not exists identifier_type public.entity_identifier_type;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'identifier_type_text'
  ) then
    update public.entity_identifiers
    set identifier_type = upper(identifier_type_text)::public.entity_identifier_type
    where identifier_type is null
      and identifier_type_text is not null;

    alter table public.entity_identifiers drop column identifier_type_text;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'identifier_type'
      and udt_name <> 'entity_identifier_type'
  ) then
    alter table public.entity_identifiers
      alter column identifier_type type public.entity_identifier_type
      using upper(identifier_type)::public.entity_identifier_type;
  end if;
end
$$;

alter table if exists public.entity_identifiers
  add column if not exists identifier_value text;

alter table if exists public.entity_identifiers
  alter column identifier_value set not null;

alter table if exists public.entity_identifiers
  alter column identifier_type set not null;

alter table if exists public.entity_identifiers
  add column if not exists is_primary boolean not null default false;

alter table if exists public.entity_identifiers
  alter column is_primary set default false;

alter table if exists public.entity_identifiers
  drop constraint if exists entity_identifiers_kind_value_key;

create unique index if not exists entity_identifiers_email_unique
  on public.entity_identifiers (lower(identifier_value))
  where identifier_type = 'EMAIL';

create unique index if not exists entity_identifiers_phone_unique
  on public.entity_identifiers (identifier_value)
  where identifier_type = 'PHONE';

create unique index if not exists entity_identifiers_primary_unique
  on public.entity_identifiers (entity_id, identifier_type)
  where is_primary;

-- ========== ALLIANCE ==========
create table if not exists public.alliances (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.alliance_guilds (
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  guild_id uuid not null,
  primary key (alliance_id, guild_id)
);

create table if not exists public.alliance_roles (
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text not null check (role in ('alliance_lord','alliance_steward','alliance_member')),
  primary key (alliance_id, entity_id, role)
);

-- ========== GUILD ==========
create table if not exists public.guild_types (
  code text primary key
);
insert into public.guild_types(code) values
  ('MERCHANT'),('ADVENTURER'),('APOTHECARY')
on conflict do nothing;

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  guild_type text not null references public.guild_types(code),
  created_at timestamptz not null default now()
);

create table if not exists public.guild_roles (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text not null check (role in ('guild_master','guild_elder','staff','supplier','customer','franchisee','org_admin','agui_user','guild_member')),
  primary key (guild_id, entity_id, role)
);

-- Parties (generic subgroup, reusable)
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('GUILD','HOUSE')),
  guild_id uuid references public.guilds(id) on delete cascade,
  house_id uuid,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists parties_guild_idx on public.parties(guild_id);
create index if not exists parties_house_idx on public.parties(house_id);

create table if not exists public.party_members (
  party_id uuid not null references public.parties(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text not null check (role in ('captain','member')),
  primary key (party_id, entity_id, role)
);

-- ========== HOUSE (COMPANY) ==========
create table if not exists public.house_types (
  code text primary key
);
insert into public.house_types(code) values
  ('RETAIL'),('MANUFACTURER'),('BRAND'),('SERVICE'),('WHOLESALE'),('DISTRIBUTOR')
on conflict do nothing;

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  slug text unique not null,
  name text not null,
  house_type text not null references public.house_types(code),
  address_json jsonb,
  tax_flags jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.house_roles (
  house_id uuid not null references public.houses(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role text not null check (role in ('house_owner','house_manager','house_staff')),
  primary key (house_id, entity_id, role)
);

-- ========== COMPAT VIEW ==========
-- If legacy 'orgs' table exists, expose a view to treat them as guilds.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='orgs') then
    create or replace view public.orgs_as_guilds as
      select
        o.id::uuid as id,
        coalesce(o.slug, lower(replace(o.name,' ','-'))) as slug,
        o.name,
        'MERCHANT'::text as guild_type,
        now() as created_at
      from public.orgs o;
  end if;
end$$;

-- Helpful indexes
create index if not exists entity_identifiers_entity_idx on public.entity_identifiers(entity_id);
create index if not exists guild_roles_entity_idx on public.guild_roles(entity_id);
create index if not exists house_roles_entity_idx on public.house_roles(entity_id);

-- NOTE: RLS can be added in a later PR; keep open while scaffolding.
