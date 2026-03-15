-- Align employees tenancy to house_id and drop workspace assumptions

-- Add house_id and backfill from existing data
alter table public.employees add column if not exists house_id uuid;

update public.employees e
set house_id = coalesce(e.house_id, e.workspace_id)
where e.house_id is null and e.workspace_id is not null;

update public.employees e
set house_id = b.house_id
from public.branches b
where e.house_id is null
  and e.branch_id = b.id;

-- Ensure house_id is required going forward
alter table public.employees alter column house_id set not null;

-- Keep FK alignment with houses
alter table public.employees
  drop constraint if exists employees_house_id_fkey;
alter table public.employees
  add constraint employees_house_id_fkey foreign key (house_id)
    references public.houses(id) on delete cascade;

-- Ensure branch, when present, belongs to the same house
create or replace function public.ensure_employee_branch_house()
returns trigger language plpgsql as $$
begin
  if new.branch_id is not null then
    if not exists (
      select 1 from public.branches b
      where b.id = new.branch_id
        and b.house_id = new.house_id
    ) then
      raise exception 'Branch % does not belong to house %', new.branch_id, new.house_id
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employees_branch_house on public.employees;
create trigger trg_employees_branch_house
before insert or update on public.employees
for each row execute function public.ensure_employee_branch_house();

-- Indexes for house scoped queries
drop index if exists employees_workspace_id_idx;
drop index if exists employees_workspace_status_idx;
drop index if exists employees_workspace_display_name_idx;
create index if not exists employees_house_id_idx on public.employees (house_id);
create index if not exists employees_house_status_idx on public.employees (house_id, status);
create index if not exists employees_house_display_name_idx on public.employees (house_id, display_name);

-- Update RLS policies to house_id
alter table public.employees enable row level security;

drop policy if exists employees_select_members on public.employees;
create policy employees_select_members
  on public.employees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = employees.house_id
        and hr.role in ('house_owner', 'house_manager')
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
    employees.house_id is not null
    and (
      exists (
        select 1
        from public.house_roles hr
        where hr.house_id = employees.house_id
          and hr.role in ('house_owner', 'house_manager')
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
      where hr.house_id = employees.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    employees.house_id is not null
    and (
      exists (
        select 1
        from public.house_roles hr
        where hr.house_id = employees.house_id
          and hr.role in ('house_owner', 'house_manager')
          and hr.entity_id = public.current_entity_id()
      )
      or public.current_entity_is_gm()
    )
  );

-- Remove workspace column once data is copied
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'workspace_id'
  ) then
    alter table public.employees drop column workspace_id;
  end if;
end$$;
