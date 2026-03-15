-- Ensure employees access, backfill house_id, and stabilize RLS with branch fallback

-- Keep column present
alter table public.employees add column if not exists house_id uuid;

-- Grant basic access to authenticated role; lock down anon
grant select, insert, update on public.employees to authenticated;
revoke all on public.employees from anon;

-- Align RLS configuration
alter table public.employees enable row level security;

-- Backfill missing house_id using branch ownership when available
update public.employees e
set house_id = b.house_id
from public.branches b
where e.house_id is null
  and e.branch_id = b.id
  and b.house_id is not null;

-- Keep house_id synchronized with branch_id and guard mismatches
create or replace function public.set_employee_house_id_from_branch()
returns trigger
language plpgsql
as $$
begin
  if new.branch_id is not null then
    select b.house_id into strict new.house_id
    from public.branches b
    where b.id = new.branch_id;
  end if;

  if new.branch_id is null and new.house_id is null then
    return new;
  end if;

  -- Prevent mismatched house/branch assignments
  if new.branch_id is not null then
    perform 1
    from public.branches b
    where b.id = new.branch_id
      and (b.house_id is null or b.house_id = new.house_id);

    if not found then
      raise exception 'Branch % does not belong to house %', new.branch_id, new.house_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_employee_house_id_from_branch on public.employees;
create trigger trg_set_employee_house_id_from_branch
before insert or update of branch_id, house_id on public.employees
for each row execute function public.set_employee_house_id_from_branch();

-- Helper to avoid NULL effective house IDs in policies
create or replace view public._employee_effective_houses as
select e.id as employee_id,
       coalesce(e.house_id, b.house_id) as effective_house_id
from public.employees e
left join public.branches b on b.id = e.branch_id;

grant select on public._employee_effective_houses to authenticated;


-- Select
drop policy if exists employees_select_members on public.employees;
create policy employees_select_members
on public.employees
for select
to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    join public._employee_effective_houses eh on eh.employee_id = employees.id
    where hr.house_id = eh.effective_house_id
      and hr.house_id is not null
      and hr.role in ('house_owner','house_manager')
      and hr.entity_id = public.current_entity_id()
  )
  or public.current_entity_is_gm()
);

-- Insert
drop policy if exists employees_insert_members on public.employees;
create policy employees_insert_members
on public.employees
for insert
to authenticated
with check (
  exists (
    select 1
    from public.house_roles hr
    join public._employee_effective_houses eh on eh.employee_id = employees.id
    where hr.house_id = eh.effective_house_id
      and hr.house_id is not null
      and hr.role in ('house_owner','house_manager')
      and hr.entity_id = public.current_entity_id()
  )
  or public.current_entity_is_gm()
);

-- Update
drop policy if exists employees_update_members on public.employees;
create policy employees_update_members
on public.employees
for update
to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    join public._employee_effective_houses eh on eh.employee_id = employees.id
    where hr.house_id = eh.effective_house_id
      and hr.house_id is not null
      and hr.role in ('house_owner','house_manager')
      and hr.entity_id = public.current_entity_id()
  )
  or public.current_entity_is_gm()
)
with check (
  exists (
    select 1
    from public.house_roles hr
    join public._employee_effective_houses eh on eh.employee_id = employees.id
    where hr.house_id = eh.effective_house_id
      and hr.house_id is not null
      and hr.role in ('house_owner','house_manager')
      and hr.entity_id = public.current_entity_id()
  )
  or public.current_entity_is_gm()
);
