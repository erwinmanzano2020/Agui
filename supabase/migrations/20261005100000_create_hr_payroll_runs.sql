-- HR-3.0 payroll runs (draft snapshots)
begin;

create table public.hr_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'cancelled')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.hr_payroll_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.hr_payroll_runs(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_minutes integer not null default 0,
  overtime_minutes_raw integer not null default 0,
  overtime_minutes_rounded integer not null default 0,
  missing_schedule_days integer not null default 0,
  open_segment_days integer not null default 0,
  corrected_segment_days integer not null default 0,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index hr_payroll_runs_house_period_idx
  on public.hr_payroll_runs (house_id, period_start, period_end);

create unique index hr_payroll_run_items_run_employee_uniq
  on public.hr_payroll_run_items (run_id, employee_id);

create index hr_payroll_run_items_house_employee_idx
  on public.hr_payroll_run_items (house_id, employee_id);

create index hr_payroll_run_items_run_idx
  on public.hr_payroll_run_items (run_id);

create or replace function public.ensure_hr_payroll_run_item_house()
returns trigger language plpgsql as $$
begin
  if new.house_id is null then
    select r.house_id into new.house_id
    from public.hr_payroll_runs r
    where r.id = new.run_id
    limit 1;
  end if;

  if new.house_id is null then
    raise exception 'House is required for payroll run item %', new.id
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.hr_payroll_runs r
    where r.id = new.run_id
      and r.house_id = new.house_id
  ) then
    raise exception 'Payroll run % does not belong to house %', new.run_id, new.house_id
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.id = new.employee_id
      and e.house_id = new.house_id
  ) then
    raise exception 'Employee % does not belong to house %', new.employee_id, new.house_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hr_payroll_run_item_house on public.hr_payroll_run_items;
create trigger trg_hr_payroll_run_item_house
before insert or update on public.hr_payroll_run_items
for each row execute function public.ensure_hr_payroll_run_item_house();

alter table public.hr_payroll_runs enable row level security;
alter table public.hr_payroll_run_items enable row level security;

grant select, insert, update, delete on public.hr_payroll_runs to authenticated;
grant select, insert, update, delete on public.hr_payroll_run_items to authenticated;
revoke all on public.hr_payroll_runs from anon;
revoke all on public.hr_payroll_run_items from anon;

create policy hr_payroll_runs_select_house_roles
  on public.hr_payroll_runs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_runs.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_payroll_run_items_select_house_roles
  on public.hr_payroll_run_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_items.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_payroll_runs_write_house_roles
  on public.hr_payroll_runs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_runs.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_payroll_runs_update_house_roles
  on public.hr_payroll_runs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_runs.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_runs.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_payroll_runs_delete_house_roles
  on public.hr_payroll_runs
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_runs.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_payroll_run_items_write_house_roles
  on public.hr_payroll_run_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_items.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_payroll_run_items_update_house_roles
  on public.hr_payroll_run_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_items.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_items.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_payroll_run_items_delete_house_roles
  on public.hr_payroll_run_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_items.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- verify:
-- select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name in ('hr_payroll_runs','hr_payroll_run_items') order by table_name, ordinal_position;
-- select relrowsecurity from pg_class where oid = 'public.hr_payroll_runs'::regclass;
-- select relrowsecurity from pg_class where oid = 'public.hr_payroll_run_items'::regclass;
-- select policyname from pg_policies where schemaname = 'public' and tablename in ('hr_payroll_runs','hr_payroll_run_items');
-- select tgname from pg_trigger where tgrelid = 'public.hr_payroll_run_items'::regclass and not tgisinternal;

notify pgrst, 'reload schema';
commit;
