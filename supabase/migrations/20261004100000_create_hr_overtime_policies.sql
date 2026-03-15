-- HR-2.3 overtime policies per house
begin;

create table public.hr_overtime_policies (
  house_id uuid primary key references public.houses(id) on delete cascade,
  timezone text not null default 'Asia/Manila',
  ot_mode text not null default 'AFTER_SCHEDULE_END',
  min_ot_minutes int not null default 10,
  rounding_minutes int not null default 1,
  rounding_mode text not null default 'NONE',
  created_at timestamptz not null default now()
);

alter table public.hr_overtime_policies enable row level security;

grant select, insert, update on public.hr_overtime_policies to authenticated;
revoke all on public.hr_overtime_policies from anon;

drop policy if exists hr_overtime_policies_select_house_roles on public.hr_overtime_policies;
create policy hr_overtime_policies_select_house_roles
  on public.hr_overtime_policies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_overtime_policies.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_overtime_policies_insert_house_roles on public.hr_overtime_policies;
create policy hr_overtime_policies_insert_house_roles
  on public.hr_overtime_policies
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_overtime_policies.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_overtime_policies_update_house_roles on public.hr_overtime_policies;
create policy hr_overtime_policies_update_house_roles
  on public.hr_overtime_policies
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_overtime_policies.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

notify pgrst, 'reload schema';
commit;
