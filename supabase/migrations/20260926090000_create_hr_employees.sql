-- HR-1A Employees core table and policies

-- Ensure helper trigger function exists
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create employees table
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.houses(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time','part_time','casual')),
  branch_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Normalize legacy column if it exists
alter table public.employees
  rename column if exists department_id to branch_id;

-- Indexes for workspace-scoped queries
create index if not exists employees_workspace_id_idx on public.employees (workspace_id);
create index if not exists employees_workspace_status_idx on public.employees (workspace_id, status);
create index if not exists employees_workspace_display_name_idx on public.employees (workspace_id, display_name);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.employees enable row level security;

-- SELECT
drop policy if exists employees_select_members on public.employees;
create policy employees_select_members
  on public.employees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = employees.workspace_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- INSERT
drop policy if exists employees_insert_members on public.employees;
create policy employees_insert_members
  on public.employees
  for insert
  to authenticated
  with check (
    employees.workspace_id is not null
    and (
      exists (
        select 1
        from public.house_roles hr
        where hr.house_id = employees.workspace_id
          and hr.role in ('house_owner', 'house_manager')
          and hr.entity_id = public.current_entity_id()
      )
      or public.current_entity_is_gm()
    )
  );

-- UPDATE
drop policy if exists employees_update_members on public.employees;
create policy employees_update_members
  on public.employees
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = employees.workspace_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    employees.workspace_id is not null
    and (
      exists (
        select 1
        from public.house_roles hr
        join public._employee_access_roles ear on ear.role = hr.role
        where hr.house_id = employees.workspace_id
          and hr.entity_id = public.current_entity_id()
      )
      or public.current_entity_is_gm()
    )
  );

-- DELETE intentionally not allowed (soft-delete via status)
