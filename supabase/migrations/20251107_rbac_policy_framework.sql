-- RBAC policy framework: roles, policies, and evaluator support

-- Allow dynamic roles in guild/house assignments
alter table if exists public.guild_roles drop constraint if exists guild_roles_role_check;
alter table if exists public.house_roles drop constraint if exists house_roles_role_check;

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  action text not null,
  resource text not null,
  description text,
  is_system boolean not null default false,
  is_assignable boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.policies enable row level security;
drop policy if exists policies_select_all on public.policies;
create policy policies_select_all
  on public.policies
  for select
  using (true);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  description text,
  scope text not null check (scope in ('PLATFORM','GUILD','HOUSE')),
  scope_ref uuid,
  scope_ref_key uuid generated always as (
    coalesce(scope_ref, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  owner_entity_id uuid references public.entities(id) on delete set null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, slug, scope_ref_key)
);

alter table public.roles enable row level security;
drop policy if exists roles_select_all on public.roles;
create policy roles_select_all
  on public.roles
  for select
  using (true);

create table if not exists public.role_policies (
  role_id uuid not null references public.roles(id) on delete cascade,
  policy_id uuid not null references public.policies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, policy_id)
);

alter table public.role_policies enable row level security;
drop policy if exists role_policies_select_all on public.role_policies;
create policy role_policies_select_all
  on public.role_policies
  for select
  using (true);

-- Views to materialize role membership and policies per entity
create or replace view public.entity_role_memberships as
select
  pr.entity_id,
  r.id as role_id,
  r.slug as role_slug,
  r.label as role_label,
  r.scope,
  null::uuid as scope_ref
from public.platform_roles pr
cross join lateral unnest(pr.roles) as role_slug
join public.roles r on r.scope = 'PLATFORM' and r.slug = role_slug
union all
select
  gr.entity_id,
  r.id as role_id,
  r.slug as role_slug,
  r.label as role_label,
  r.scope,
  gr.guild_id as scope_ref
from public.guild_roles gr
join public.roles r
  on r.scope = 'GUILD'
 and r.slug = gr.role
 and (r.scope_ref is null or r.scope_ref = gr.guild_id)
union all
select
  hr.entity_id,
  r.id as role_id,
  r.slug as role_slug,
  r.label as role_label,
  r.scope,
  hr.house_id as scope_ref
from public.house_roles hr
join public.roles r
  on r.scope = 'HOUSE'
 and r.slug = hr.role
 and (r.scope_ref is null or r.scope_ref = hr.house_id);

create or replace view public.entity_policies as
select distinct
  erm.entity_id,
  erm.role_id,
  erm.role_slug,
  erm.scope,
  erm.scope_ref,
  p.id as policy_id,
  p.key as policy_key,
  p.action,
  p.resource
from public.entity_role_memberships erm
join public.role_policies rp on rp.role_id = erm.role_id
join public.policies p on p.id = rp.policy_id;

create or replace view public.role_policy_catalog as
select
  r.id as role_id,
  r.slug as role_slug,
  r.label as role_label,
  r.scope,
  r.scope_ref,
  p.id as policy_id,
  p.key as policy_key,
  p.action,
  p.resource,
  p.description,
  p.is_assignable
from public.role_policies rp
join public.roles r on r.id = rp.role_id
join public.policies p on p.id = rp.policy_id;

-- Seed default policies
insert into public.policies (key, action, resource, description, is_system, is_assignable)
values
  ('tiles.alliances.read', 'tiles:read', 'alliances', 'Access alliances tile', true, true),
  ('apps.alliances.discover', 'apps:discover', 'alliances', 'Discover alliances app', true, true),
  ('tiles.guilds.read', 'tiles:read', 'guilds', 'Access guilds tile', true, true),
  ('apps.guilds.discover', 'apps:discover', 'guilds', 'Discover guilds app', true, true),
  ('tiles.team.read', 'tiles:read', 'team', 'Access team tile', true, true),
  ('apps.team.discover', 'apps:discover', 'team', 'Discover team app', true, true),
  ('tiles.shifts.read', 'tiles:read', 'shifts', 'Access shifts tile', true, true),
  ('apps.shifts.discover', 'apps:discover', 'shifts', 'Discover shifts app', true, true),
  ('tiles.dtr.bulk.read', 'tiles:read', 'dtr-bulk', 'Access DTR bulk tile', true, true),
  ('apps.dtr.bulk.discover', 'apps:discover', 'dtr-bulk', 'Discover DTR tools', true, true),
  ('tiles.payroll.read', 'tiles:read', 'payroll', 'Access payroll tile', true, true),
  ('apps.payroll.discover', 'apps:discover', 'payroll', 'Discover payroll app', true, true),
  ('tiles.pos.read', 'tiles:read', 'pos', 'Access POS tile', true, true),
  ('apps.pos.discover', 'apps:discover', 'pos', 'Discover POS app', true, true),
  ('tiles.alliance.pass.read', 'tiles:read', 'alliance-pass', 'Access alliance pass tile', true, true),
  ('apps.alliance.pass.discover', 'apps:discover', 'alliance-pass', 'Discover alliance pass tools', true, true),
  ('tiles.import.csv.read', 'tiles:read', 'import-csv', 'Access CSV import tile', true, true),
  ('apps.import.csv.discover', 'apps:discover', 'import-csv', 'Discover import tools', true, true),
  ('tiles.settings.read', 'tiles:read', 'settings', 'Access settings tile', true, true),
  ('apps.settings.discover', 'apps:discover', 'settings', 'Discover settings', true, true),
  ('domain.payroll.all', 'payroll:*', '*', 'Full payroll access', true, false),
  ('domain.ledger.all', 'ledger:*', '*', 'Full ledger access', true, false),
  ('roles.manage.house', 'roles:manage', 'house', 'Manage custom house roles', true, true)
on conflict (key) do update set
  action = excluded.action,
  resource = excluded.resource,
  description = excluded.description,
  is_system = excluded.is_system,
  is_assignable = excluded.is_assignable;

-- Seed default roles
insert into public.roles (slug, label, description, scope, scope_ref, owner_entity_id, is_system)
values
  ('game_master', 'Game Master', 'Platform superuser', 'PLATFORM', null, null, true),
  ('guild_master', 'Guild Master', 'Manage guild operations', 'GUILD', null, null, true),
  ('guild_elder', 'Guild Elder', 'Alliance leader privileges', 'GUILD', null, null, true),
  ('house_owner', 'Business Owner', 'Owns and manages the house', 'HOUSE', null, null, true),
  ('house_manager', 'House Manager', 'Oversees staff operations', 'HOUSE', null, null, true),
  ('house_staff', 'House Staff', 'General employee access', 'HOUSE', null, null, true),
  ('cashier', 'Cashier', 'Point-of-sale attendant', 'HOUSE', null, null, true),
  ('customer', 'Customer', 'Customer or guest role', 'HOUSE', null, null, true)
on conflict (scope, slug, scope_ref_key) do update set
  label = excluded.label,
  description = excluded.description,
  is_system = excluded.is_system;

-- Link default roles to policy packs
with
  gm as (select id from public.roles where scope = 'PLATFORM' and slug = 'game_master' limit 1),
  guild_master as (select id from public.roles where scope = 'GUILD' and slug = 'guild_master' limit 1),
  guild_elder as (select id from public.roles where scope = 'GUILD' and slug = 'guild_elder' limit 1),
  house_owner as (select id from public.roles where scope = 'HOUSE' and slug = 'house_owner' limit 1),
  house_manager as (select id from public.roles where scope = 'HOUSE' and slug = 'house_manager' limit 1),
  house_staff as (select id from public.roles where scope = 'HOUSE' and slug = 'house_staff' limit 1),
  cashier as (select id from public.roles where scope = 'HOUSE' and slug = 'cashier' limit 1)
insert into public.role_policies (role_id, policy_id)
select gm.id, p.id from gm cross join public.policies p
where gm.id is not null
on conflict do nothing;

with policies as (
  select key, id from public.policies
),
role_ids as (
  select 'guild_master' as slug, id from public.roles where scope = 'GUILD' and slug = 'guild_master'
  union all
  select 'guild_elder', id from public.roles where scope = 'GUILD' and slug = 'guild_elder'
  union all
  select 'house_owner', id from public.roles where scope = 'HOUSE' and slug = 'house_owner'
  union all
  select 'house_manager', id from public.roles where scope = 'HOUSE' and slug = 'house_manager'
  union all
  select 'house_staff', id from public.roles where scope = 'HOUSE' and slug = 'house_staff'
  union all
  select 'cashier', id from public.roles where scope = 'HOUSE' and slug = 'cashier'
)
insert into public.role_policies (role_id, policy_id)
select
  role_ids.id,
  policies.id
from role_ids
join policies on (
  (role_ids.slug = 'guild_master' and policies.key in ('tiles.guilds.read','apps.guilds.discover'))
  or
  (role_ids.slug = 'guild_elder' and policies.key in ('tiles.alliance.pass.read','apps.alliance.pass.discover'))
  or
  (role_ids.slug = 'house_owner' and policies.key in (
    'tiles.team.read','apps.team.discover',
    'tiles.shifts.read','apps.shifts.discover',
    'tiles.dtr.bulk.read','apps.dtr.bulk.discover',
    'tiles.payroll.read','apps.payroll.discover',
    'tiles.pos.read','apps.pos.discover',
    'domain.payroll.all','domain.ledger.all',
    'roles.manage.house'
  ))
  or
  (role_ids.slug = 'house_manager' and policies.key in (
    'tiles.team.read','apps.team.discover',
    'tiles.shifts.read','apps.shifts.discover',
    'tiles.dtr.bulk.read','apps.dtr.bulk.discover',
    'tiles.payroll.read','apps.payroll.discover',
    'tiles.pos.read','apps.pos.discover',
    'domain.payroll.all'
  ))
  or
  (role_ids.slug = 'house_staff' and policies.key in ('tiles.pos.read','apps.pos.discover'))
  or
  (role_ids.slug = 'cashier' and policies.key in ('tiles.pos.read','apps.pos.discover'))
)
on conflict do nothing;
