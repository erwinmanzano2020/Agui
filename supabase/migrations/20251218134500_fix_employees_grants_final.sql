-- Reapply authenticated privileges on employees/branches to prevent 42501 errors when hitting HR Employees
-- Idempotent and safe to rerun.

-- Ensure authenticated can use the schema
grant usage on schema public to authenticated;

-- Core table privileges (RLS still applies)
grant select, insert, update on public.employees to authenticated;
grant select on public.branches to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Keep anon locked down
revoke all on public.employees from anon;
revoke select on public.branches from anon;

-- Optionally expose helper view when present (used by policies)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = '_employee_access_roles'
  ) then
    execute 'grant select on public._employee_access_roles to authenticated';
  end if;
end;
$$;

-- Verification (run in Supabase SQL editor):
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and table_name='employees' order by grantee, privilege_type;
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and table_name='branches' order by grantee, privilege_type;
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and table_name='_employee_access_roles' order by grantee, privilege_type;
