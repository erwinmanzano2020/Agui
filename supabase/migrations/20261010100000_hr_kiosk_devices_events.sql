begin;

create table if not exists public.hr_kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  token_hash text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists hr_kiosk_devices_token_hash_uniq
  on public.hr_kiosk_devices (token_hash);

create index if not exists hr_kiosk_devices_house_branch_idx
  on public.hr_kiosk_devices (house_id, branch_id);

create table if not exists public.hr_kiosk_events (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  event_type text not null check (event_type in ('scan','clock_in','clock_out','reject','queued','sync_success','sync_fail')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hr_kiosk_events_house_branch_occurred_idx
  on public.hr_kiosk_events (house_id, branch_id, occurred_at desc);

create index if not exists hr_kiosk_events_employee_occurred_idx
  on public.hr_kiosk_events (employee_id, occurred_at desc)
  where employee_id is not null;

alter table public.hr_kiosk_devices enable row level security;
alter table public.hr_kiosk_events enable row level security;

grant select, insert, update, delete on public.hr_kiosk_devices to authenticated;
grant select, insert, update, delete on public.hr_kiosk_events to authenticated;
revoke all on public.hr_kiosk_devices from anon;
revoke all on public.hr_kiosk_events from anon;

drop policy if exists hr_kiosk_devices_select_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_select_house_roles
  on public.hr_kiosk_devices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_devices_insert_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_insert_house_roles
  on public.hr_kiosk_devices
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_devices_update_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_update_house_roles
  on public.hr_kiosk_devices
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_devices_delete_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_delete_house_roles
  on public.hr_kiosk_devices
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_select_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_select_house_roles
  on public.hr_kiosk_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_insert_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_insert_house_roles
  on public.hr_kiosk_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_update_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_update_house_roles
  on public.hr_kiosk_events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_delete_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_delete_house_roles
  on public.hr_kiosk_events
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- verify:
-- select column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('hr_kiosk_devices','hr_kiosk_events') order by table_name, ordinal_position;
-- select relrowsecurity from pg_class where oid in ('public.hr_kiosk_devices'::regclass, 'public.hr_kiosk_events'::regclass);
-- select policyname from pg_policies where schemaname='public' and tablename in ('hr_kiosk_devices','hr_kiosk_events');

notify pgrst, 'reload schema';
commit;
