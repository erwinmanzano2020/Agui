-- HR-3.2 house pay policies for payslip previews
begin;

create table public.hr_pay_policies (
  house_id uuid primary key references public.houses(id) on delete cascade,
  minutes_per_day_default int not null default 480,
  derive_minutes_from_schedule boolean not null default true,
  ot_multiplier numeric not null default 1.0,
  created_at timestamptz not null default now()
);

alter table public.hr_pay_policies enable row level security;

grant select, insert, update on public.hr_pay_policies to authenticated;
revoke all on public.hr_pay_policies from anon;

drop policy if exists hr_pay_policies_select_house_roles on public.hr_pay_policies;
create policy hr_pay_policies_select_house_roles
  on public.hr_pay_policies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_pay_policies.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_pay_policies_insert_house_roles on public.hr_pay_policies;
create policy hr_pay_policies_insert_house_roles
  on public.hr_pay_policies
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_pay_policies.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_pay_policies_update_house_roles on public.hr_pay_policies;
create policy hr_pay_policies_update_house_roles
  on public.hr_pay_policies
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_pay_policies.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

notify pgrst, 'reload schema';
commit;
