-- HR-2.1: Enable write access to dtr_segments via house-scoped RLS policies.
-- Motivation: HR Daily DTR entry must INSERT/UPDATE segments. Previously SELECT-only caused:
-- "new row violates row-level security policy for table dtr_segments".

begin;

-- Grants (authenticated can write; RLS still enforces access)
grant insert, update, delete on public.dtr_segments to authenticated;

-- INSERT policy (WITH CHECK controls inserted row visibility/validity)
drop policy if exists dtr_segments_insert_house_roles on public.dtr_segments;
create policy dtr_segments_insert_house_roles
  on public.dtr_segments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = dtr_segments.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- UPDATE policy (USING controls which rows are updatable; WITH CHECK controls new values)
drop policy if exists dtr_segments_update_house_roles on public.dtr_segments;
create policy dtr_segments_update_house_roles
  on public.dtr_segments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = dtr_segments.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = dtr_segments.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- DELETE policy
drop policy if exists dtr_segments_delete_house_roles on public.dtr_segments;
create policy dtr_segments_delete_house_roles
  on public.dtr_segments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = dtr_segments.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- Verification (copy/paste)
-- select tablename, policyname, permissive, roles, cmd
-- from pg_policies
-- where schemaname='public' and tablename='dtr_segments'
-- order by policyname;
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='dtr_segments'
-- order by grantee, privilege_type;

notify pgrst, 'reload schema';
commit;
