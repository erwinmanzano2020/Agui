-- HR-Infra: ensure employees.house_id exists and branch access is house-scoped

-- 1) Ensure column exists
alter table public.employees add column if not exists house_id uuid;

-- 2) Backfill house_id from branch ownership first, then workspace fallback when present
DO $$
BEGIN
  -- Prefer branch -> house mapping when a branch is assigned
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'branch_id'
  ) THEN
    UPDATE public.employees e
    SET house_id = COALESCE(e.house_id, b.house_id)
    FROM public.branches b
    WHERE e.house_id IS NULL
      AND e.branch_id = b.id;
  END IF;

  -- Fallback to workspace_id when available
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'workspace_id'
  ) THEN
    UPDATE public.employees e
    SET house_id = COALESCE(e.house_id, e.workspace_id)
    WHERE e.house_id IS NULL
      AND e.workspace_id IS NOT NULL;
  END IF;
END$$;

-- 3) Enforce NOT NULL only when data is fully populated
DO $$
DECLARE
  missing integer;
BEGIN
  SELECT count(*) INTO missing FROM public.employees WHERE house_id IS NULL;
  IF missing = 0 THEN
    ALTER TABLE public.employees ALTER COLUMN house_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'employees.house_id remains NULL for % rows; keeping column nullable', missing;
  END IF;
END$$;

-- 4) Keep FK and indexes aligned
alter table public.employees
  drop constraint if exists employees_house_id_fkey;
alter table public.employees
  add constraint employees_house_id_fkey foreign key (house_id)
    references public.houses(id) on delete cascade;

create index if not exists employees_house_id_idx on public.employees (house_id);
create index if not exists employees_house_status_idx on public.employees (house_id, status);
create index if not exists employees_house_branch_idx on public.employees (house_id, branch_id);

-- 5) Guard cross-house branch assignment
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

-- 6) Grants for branches (keeps RLS intact)
GRANT SELECT ON public.branches TO authenticated;
REVOKE ALL ON public.branches FROM anon;

-- 7) RLS policies scoped by house_id
alter table public.employees enable row level security;
alter table public.branches enable row level security;

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
        join public._employee_access_roles ear on ear.role = hr.role
        where hr.house_id = employees.house_id
          and hr.entity_id = public.current_entity_id()
      )
      or public.current_entity_is_gm()
    )
  );

drop policy if exists branches_select_house_roles on public.branches;
create policy branches_select_house_roles
  on public.branches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = branches.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );
