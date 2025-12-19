-- Reaffirm employees/branches grants so authenticated users can hit HR Employees without privilege errors
-- (idempotent: safe to run multiple times)

-- Schema usage for authenticated role
grant usage on schema public to authenticated;

-- Core table grants
grant select, insert, update on public.employees to authenticated;
grant select on public.branches to authenticated;

-- Optional: keep anon locked down
revoke all on public.employees from anon;
revoke select on public.branches from anon;

-- If the helper view exists, grant read access so policies depending on it do not fail
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

-- Verification snippet (run in Supabase SQL editor):
-- select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='employees' order by grantee, privilege_type;
-- select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='branches' order by grantee, privilege_type;
-- select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='_employee_access_roles' order by grantee, privilege_type;
