create table if not exists public.pos_devices (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.houses(id) on delete cascade,
  label text not null,
  device_code text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISABLED', 'RETIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pos_devices_house_device_code_unique
  on public.pos_devices(house_id, device_code);
create index if not exists pos_devices_house_branch_idx
  on public.pos_devices(house_id, branch_id);

create table if not exists public.pos_operator_credentials (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pos_operator_credentials_house_entity_unique
  on public.pos_operator_credentials(house_id, entity_id);

create table if not exists public.pos_sessions (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.houses(id) on delete cascade,
  device_id uuid not null references public.pos_devices(id) on delete restrict,
  operator_entity_id uuid not null references public.entities(id) on delete restrict,
  opened_by_entity_id uuid not null references public.entities(id) on delete restrict,
  closed_by_entity_id uuid references public.entities(id) on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pos_sessions_open_device_unique
  on public.pos_sessions(device_id)
  where status = 'OPEN';
create index if not exists pos_sessions_house_branch_status_idx
  on public.pos_sessions(house_id, branch_id, status);

drop trigger if exists set_pos_devices_updated_at on public.pos_devices;
create trigger set_pos_devices_updated_at
before update on public.pos_devices
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_pos_operator_credentials_updated_at on public.pos_operator_credentials;
create trigger set_pos_operator_credentials_updated_at
before update on public.pos_operator_credentials
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_pos_sessions_updated_at on public.pos_sessions;
create trigger set_pos_sessions_updated_at
before update on public.pos_sessions
for each row execute function public.set_current_timestamp_updated_at();

grant select, insert, update on table public.pos_devices to authenticated;
grant select, insert, update on table public.pos_operator_credentials to authenticated;
grant select, insert, update on table public.pos_sessions to authenticated;

alter table public.pos_devices enable row level security;
alter table public.pos_operator_credentials enable row level security;
alter table public.pos_sessions enable row level security;

drop policy if exists pos_devices_manage_by_house on public.pos_devices;

create policy pos_devices_manage_by_house on public.pos_devices
for all to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_devices.house_id
      and hr.entity_id = public.current_entity_id()
  )
)
with check (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_devices.house_id
      and hr.entity_id = public.current_entity_id()
  )
);

drop policy if exists pos_operator_credentials_manage_by_house on public.pos_operator_credentials;

create policy pos_operator_credentials_manage_by_house on public.pos_operator_credentials
for all to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_operator_credentials.house_id
      and hr.entity_id = public.current_entity_id()
  )
)
with check (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_operator_credentials.house_id
      and hr.entity_id = public.current_entity_id()
  )
);

drop policy if exists pos_sessions_manage_by_house on public.pos_sessions;

create policy pos_sessions_manage_by_house on public.pos_sessions
for all to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_sessions.house_id
      and hr.entity_id = public.current_entity_id()
  )
)
with check (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_sessions.house_id
      and hr.entity_id = public.current_entity_id()
  )
);
