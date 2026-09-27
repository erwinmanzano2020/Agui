-- GAP-024 Remaining Gate B: additive kiosk supporting-state wrappers.
-- This migration is intentionally backward-compatible. It adds the wrapper-capable
-- contract but does NOT revoke the existing raw kiosk/canonical grants; that cutover is
-- performed only by the later approved privilege migration after the exact application
-- artifact has moved to these wrappers.
begin;

create or replace function public.hr_record_kiosk_support_event(
  p_device_id uuid,
  p_employee_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_device public.hr_kiosk_devices%rowtype;
begin
  if p_device_id is null
    or p_event_type is null
    or p_event_type not in ('reject', 'sync_success', 'sync_fail')
    or p_occurred_at is null then
    raise exception 'Invalid kiosk support event'
      using errcode = '22023';
  end if;

  select device.*
  into v_device
  from public.hr_kiosk_devices device
  where device.id = p_device_id
  for update;

  if not found then
    raise exception 'Kiosk support event requires an existing device'
      using errcode = '23503';
  end if;

  if p_employee_id is not null then
    perform 1
    from public.employees employee
    where employee.id = p_employee_id
      and employee.house_id = v_device.house_id;

    if not found then
      raise exception 'Kiosk support event employee must belong to the device House'
        using errcode = '23503';
    end if;
  end if;

  insert into public.hr_kiosk_events (
    house_id,
    branch_id,
    device_id,
    employee_id,
    event_type,
    occurred_at,
    metadata
  )
  values (
    v_device.house_id,
    v_device.branch_id,
    v_device.id,
    p_employee_id,
    p_event_type,
    p_occurred_at,
    coalesce(p_metadata, '{}'::jsonb)
  );

  update public.hr_kiosk_devices
  set last_event_at = p_occurred_at
  where id = v_device.id;
end
$function$;

create or replace function public.hr_touch_kiosk_device_telemetry(
  p_device_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_device_id is null then
    raise exception 'Kiosk telemetry touch requires a device'
      using errcode = '22023';
  end if;

  update public.hr_kiosk_devices
  set last_seen_at = now()
  where id = p_device_id;

  if not found then
    raise exception 'Kiosk telemetry touch requires an existing device'
      using errcode = '23503';
  end if;
end
$function$;

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

comment on function public.hr_record_kiosk_support_event(
  uuid, uuid, text, timestamptz, jsonb
) is
  'Remaining Gate-B service-role kiosk support-event wrapper. Derives House/branch from the device and permits only reject/sync_success/sync_fail supporting events.';

comment on function public.hr_touch_kiosk_device_telemetry(
  uuid
) is
  'Remaining Gate-B service-role kiosk telemetry wrapper. Updates only hr_kiosk_devices.last_seen_at for the existing device.';

notify pgrst, 'reload schema';
commit;
