-- GAP-024 Remaining Gate B: final canonical/supporting-state privilege cutover.
-- Apply only after the exact wrapper-capable application artifact is serving.
begin;

-- Canonical attendance authority is command-owned. Normal application principals must
-- not have direct table access; approved read/write behavior is exposed through bounded
-- RPCs instead.
do $revoke$
declare
  v_relation record;
begin
  for v_relation in
    select format('%I.%I', n.nspname, c.relname) as qualified_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname like 'hr_attendance_%'
  loop
    execute format(
      'revoke all privileges on table %s from public, anon, authenticated, service_role',
      v_relation.qualified_name
    );
  end loop;
end
$revoke$;

-- The projection rebuild is an internal authority maintenance primitive, not an
-- application service-role mutation endpoint.
revoke all on function public.hr_rebuild_attendance_authorization_projection(
  uuid
) from service_role;

-- Trigger/guard helpers are private implementation details. Trigger execution does not
-- require application roles to retain direct EXECUTE on their trigger functions.
do $revoke_helpers$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'hr_guard_attendance_%'
        or p.proname = 'hr_reject_attendance_history_mutation'
        or p.proname = 'hr_kiosk_validate_branch_house_match'
      )
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated, service_role',
      v_function.signature
    );
  end loop;
end
$revoke_helpers$;

-- Kiosk events remain readable to authorized authenticated HR users, but supporting
-- event mutation is no longer a raw-table capability.
drop policy if exists hr_kiosk_events_insert_house_roles on public.hr_kiosk_events;
drop policy if exists hr_kiosk_events_update_house_roles on public.hr_kiosk_events;
drop policy if exists hr_kiosk_events_delete_house_roles on public.hr_kiosk_events;

revoke all privileges on table public.hr_kiosk_events from authenticated;
grant select on table public.hr_kiosk_events to authenticated;
revoke all privileges on table public.hr_kiosk_events from service_role;

-- Device token lookup still needs service-role SELECT. All service-side telemetry writes
-- now go through the narrow wrappers; authenticated owner/manager device administration
-- remains governed by the existing RLS policies.
revoke all privileges on table public.hr_kiosk_devices from service_role;
grant select on table public.hr_kiosk_devices to service_role;

-- Freeze the service-role callable attendance/support boundary.
revoke all on function public.hr_apply_kiosk_attendance_scan(
  uuid, uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.hr_apply_kiosk_attendance_scan(
  uuid, uuid, uuid, uuid, text, timestamptz
) to service_role;

revoke all on function public.hr_record_kiosk_support_event(
  uuid, uuid, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.hr_record_kiosk_support_event(
  uuid, uuid, text, timestamptz, jsonb
) to service_role;

revoke all on function public.hr_touch_kiosk_device_telemetry(
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.hr_touch_kiosk_device_telemetry(
  uuid
) to service_role;

-- Fail closed if the cutover leaves any known direct mutation bypass.
do $verify$
begin
  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name like 'hr_attendance_%'
      and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) then
    raise exception 'Remaining Gate-B cutover left direct canonical attendance table privileges'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name = 'hr_kiosk_events'
      and grant_row.grantee = 'authenticated'
      and grant_row.privilege_type <> 'SELECT'
  ) then
    raise exception 'Remaining Gate-B cutover left authenticated kiosk-event mutation privileges'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name = 'hr_kiosk_events'
      and grant_row.grantee = 'service_role'
  ) then
    raise exception 'Remaining Gate-B cutover left service-role kiosk-event table privileges'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name = 'hr_kiosk_devices'
      and grant_row.grantee = 'service_role'
      and grant_row.privilege_type <> 'SELECT'
  ) then
    raise exception 'Remaining Gate-B cutover left service-role kiosk-device mutation privileges'
      using errcode = '55000';
  end if;

  if has_function_privilege(
    'service_role',
    'public.hr_rebuild_attendance_authorization_projection(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Remaining Gate-B cutover left service-role projection rebuild EXECUTE'
      using errcode = '55000';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.hr_apply_kiosk_attendance_scan(uuid,uuid,uuid,uuid,text,timestamptz)',
    'EXECUTE'
  )
  or not has_function_privilege(
    'service_role',
    'public.hr_record_kiosk_support_event(uuid,uuid,text,timestamptz,jsonb)',
    'EXECUTE'
  )
  or not has_function_privilege(
    'service_role',
    'public.hr_touch_kiosk_device_telemetry(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Remaining Gate-B cutover removed an approved kiosk service entrypoint'
      using errcode = '55000';
  end if;
end
$verify$;

notify pgrst, 'reload schema';
commit;
