-- Align employees.house_id population and RLS with branch-scoped access

-- Ensure column exists
alter table public.employees add column if not exists house_id uuid;

-- Backfill missing house_id values from branches when available
update public.employees e
set house_id = b.house_id
from public.branches b
where e.house_id is null
  and e.branch_id = b.id
  and b.house_id is not null;

-- Keep house_id in sync when branch_id is set on writes
create or replace function public.set_employee_house_id_from_branch()
returns trigger
language plpgsql
as $$
begin
  if new.house_id is null and new.branch_id is not null then
    select b.house_id into new.house_id
    from public.branches b
    where b.id = new.branch_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_employee_house_id_from_branch on public.employees;
create trigger trg_set_employee_house_id_from_branch
before insert or update of branch_id, house_id on public.employees
for each row execute function public.set_employee_house_id_from_branch();

-- Keep branches readable to authenticated users (RLS will scope)
grant select on public.branches to authenticated;
revoke all on public.branches from anon;

-- Ensure RLS is active
alter table public.branches enable row level security;
alter table public.employees enable row level security;

-- Branch read access scoped by house ownership
create policy if not exists branches_select_members
on public.branches
for select
using (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = branches.house_id
      and hr.role in ('house_owner','house_manager')
      and hr.entity_id = public.current_entity_id()
  )
  or public.current_entity_is_gm()
);

-- Policies using an effective house id that falls back to branch ownership

drop policy if exists employees_select_members on public.employees;
create policy employees_select_members
on public.employees
for select
to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    left join public.branches b on b.id = employees.branch_id
    where hr.house_id = coalesce(employees.house_id, b.house_id)
      and hr.house_id is not null
      and hr.role in ('house_owner','house_manager')
      and hr.entity_id = public.current_entity_id()
  )
  or public.current_entity_is_gm()
);

drop policy if exists employees_insert_members on public.employees;
create policy employees_insert_members
on public.employees
for insert
to authenticated
with check (
  coalesce(
    employees.house_id,
    (select b.house_id from public.branches b where b.id = employees.branch_id limit 1)
  ) is not null
  and (
    exists (
      select 1
      from public.house_roles hr
      left join public.branches b on b.id = employees.branch_id
      where hr.house_id = coalesce(employees.house_id, b.house_id)
        and hr.house_id is not null
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
);

drop policy if exists employees_update_members on public.employees;
create policy employees_update_members
on public.employees
for update
to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    left join public.branches b on b.id = employees.branch_id
    where hr.house_id = coalesce(employees.house_id, b.house_id)
      and hr.house_id is not null
      and hr.role in ('house_owner','house_manager')
      and hr.entity_id = public.current_entity_id()
  )
  or public.current_entity_is_gm()
)
with check (
  coalesce(
    employees.house_id,
    (select b.house_id from public.branches b where b.id = employees.branch_id limit 1)
  ) is not null
  and (
    exists (
      select 1
      from public.house_roles hr
      left join public.branches b on b.id = employees.branch_id
      where hr.house_id = coalesce(employees.house_id, b.house_id)
        and hr.house_id is not null
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
);
