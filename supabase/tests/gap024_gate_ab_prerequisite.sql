-- Test-only prerequisite schema for the GAP-024 Gate-A/Gate-B disposable CI harness.
-- This is NOT a product migration. It models only the current live contracts that the
-- approved Gate-A/Gate-B migrations expect to already exist.

create extension if not exists pgcrypto;

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'PERSON',
  display_name text,
  universal_code text unique,
  is_gm boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_id()
returns uuid
language sql
stable
set search_path = pg_catalog, public
as $function$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$function$;

create or replace function public.current_entity_id()
returns uuid
language sql
stable
set search_path = pg_catalog, public
as $function$
  select account.entity_id
  from public.accounts account
  where account.user_id = public.current_user_id()
$function$;

create or replace function public.current_entity_is_gm()
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $function$
  select coalesce((
    select entity.is_gm
    from public.entities entity
    where entity.id = public.current_entity_id()
  ), false)
$function$;

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  house_type text not null default 'RETAIL',
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  house_id uuid references public.houses(id) on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text,
  slug text,
  scope text,
  scope_ref uuid
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  key text not null unique
);

create table if not exists public.role_policies (
  role_id uuid not null references public.roles(id) on delete cascade,
  policy_id uuid not null references public.policies(id) on delete cascade,
  primary key (role_id, policy_id)
);

create table if not exists public.entity_policies (
  entity_id uuid not null references public.entities(id) on delete cascade,
  policy_id uuid not null references public.policies(id) on delete cascade,
  primary key (entity_id, policy_id)
);

create table if not exists public.platform_roles (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  roles text[] not null default '{}'::text[]
);

create table if not exists public.house_roles (
  house_id uuid not null references public.houses(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  role text not null,
  created_at timestamptz default now(),
  primary key (house_id, entity_id, role)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  full_name text not null,
  rate_per_day numeric not null default 0,
  status text not null default 'active',
  branch_id uuid references public.branches(id),
  house_id uuid not null references public.houses(id) on delete cascade,
  entity_id uuid references public.entities(id),
  created_at timestamptz default now()
);

create table if not exists public.dtr_segments (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  hours_worked numeric,
  overtime_minutes integer not null default 0,
  source text not null default 'manual'
    check (source in ('manual','bulk','pos','system')),
  status text not null default 'open'
    check (status in ('open','closed','corrected')),
  created_at timestamptz not null default now()
);

create index if not exists dtr_segments_house_date_idx
  on public.dtr_segments(house_id, work_date);
create index if not exists dtr_segments_employee_date_idx
  on public.dtr_segments(employee_id, work_date);

create table if not exists public.dtr_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  minutes_regular integer default 0,
  minutes_ot integer default 0,
  notes text,
  minutes_late integer default 0,
  minutes_undertime integer default 0,
  unique (employee_id, work_date)
);

create table if not exists public.hr_kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_kiosk_events (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_id uuid references public.hr_kiosk_devices(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Pre-Gate-B raw compatibility posture. The cutover migration must remove these writes.
alter table public.dtr_segments enable row level security;
grant select, insert, update, delete, truncate, references, trigger
  on public.dtr_segments to authenticated, service_role;

drop policy if exists dtr_segments_all on public.dtr_segments;
create policy dtr_segments_all
  on public.dtr_segments
  for all
  to authenticated
  using (true)
  with check (true);

alter table public.dtr_entries enable row level security;
grant select on public.dtr_entries to authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.dtr_entries to service_role;

drop policy if exists dtr_entries_all on public.dtr_entries;
create policy dtr_entries_all
  on public.dtr_entries
  for all
  to authenticated
  using (true)
  with check (true);

grant select on public.entities, public.accounts, public.houses, public.branches,
  public.house_roles, public.roles, public.policies, public.role_policies,
  public.entity_policies, public.platform_roles, public.employees,
  public.hr_kiosk_devices, public.hr_kiosk_events
  to authenticated;

grant execute on function public.current_user_id() to authenticated;
grant execute on function public.current_entity_id() to authenticated;
grant execute on function public.current_entity_is_gm() to authenticated;
