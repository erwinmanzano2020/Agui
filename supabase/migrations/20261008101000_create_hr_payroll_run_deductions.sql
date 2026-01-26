-- HR-3.2 optional manual deductions per payroll run
begin;

create table public.hr_payroll_run_deductions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.hr_payroll_runs(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  label text not null,
  amount numeric not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index hr_payroll_run_deductions_run_employee_idx
  on public.hr_payroll_run_deductions (run_id, employee_id);

create or replace function public.ensure_hr_payroll_run_deduction_house()
returns trigger language plpgsql as $$
begin
  if new.house_id is null then
    select r.house_id into new.house_id
    from public.hr_payroll_runs r
    where r.id = new.run_id
    limit 1;
  end if;

  if new.house_id is null then
    raise exception 'House is required for payroll run deduction %', new.id
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

create or replace function public.prevent_finalized_payroll_run_deduction_mutation()
returns trigger language plpgsql as $$
declare
  run_status text;
  target_run_id uuid;
begin
  target_run_id := coalesce(new.run_id, old.run_id);

  select r.status into run_status
  from public.hr_payroll_runs r
  where r.id = target_run_id
  limit 1;

  if run_status = 'finalized' then
    raise exception 'Payroll run is finalized and deductions cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hr_payroll_run_deductions_house on public.hr_payroll_run_deductions;
create trigger trg_hr_payroll_run_deductions_house
before insert or update on public.hr_payroll_run_deductions
for each row execute function public.ensure_hr_payroll_run_deduction_house();

drop trigger if exists trg_hr_payroll_run_deductions_finalized_lock on public.hr_payroll_run_deductions;
create trigger trg_hr_payroll_run_deductions_finalized_lock
before insert or update or delete on public.hr_payroll_run_deductions
for each row execute function public.prevent_finalized_payroll_run_deduction_mutation();

alter table public.hr_payroll_run_deductions enable row level security;

grant select, insert, update, delete on public.hr_payroll_run_deductions to authenticated;
revoke all on public.hr_payroll_run_deductions from anon;

drop policy if exists hr_payroll_run_deductions_select_house_roles on public.hr_payroll_run_deductions;
create policy hr_payroll_run_deductions_select_house_roles
  on public.hr_payroll_run_deductions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_deductions.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_payroll_run_deductions_write_house_roles on public.hr_payroll_run_deductions;
create policy hr_payroll_run_deductions_write_house_roles
  on public.hr_payroll_run_deductions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_deductions.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_payroll_run_deductions_update_house_roles on public.hr_payroll_run_deductions;
create policy hr_payroll_run_deductions_update_house_roles
  on public.hr_payroll_run_deductions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_deductions.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_deductions.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_payroll_run_deductions_delete_house_roles on public.hr_payroll_run_deductions;
create policy hr_payroll_run_deductions_delete_house_roles
  on public.hr_payroll_run_deductions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_payroll_run_deductions.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

notify pgrst, 'reload schema';
commit;
