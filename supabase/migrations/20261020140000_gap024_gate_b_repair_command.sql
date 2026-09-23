-- GAP-024 Gate B audited maintenance repair command.
-- Administrative/break-glass only: no application role receives EXECUTE.
begin;

create or replace function public.hr_apply_attendance_time_repair(
  p_house_id uuid,
  p_segment_id uuid,
  p_operation_id text,
  p_reason text,
  p_time_in timestamptz,
  p_time_out timestamptz,
  p_expected_value_revision bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_segment public.dtr_segments%rowtype;
  v_result jsonb;
  v_fingerprint text;
begin
  if p_house_id is null
    or p_segment_id is null
    or p_operation_id is null
    or length(btrim(p_operation_id)) = 0
    or p_reason is null
    or length(btrim(p_reason)) < 3
    or p_time_in is null
    or p_time_out is null
    or p_time_out <= p_time_in then
    raise exception 'Invalid attendance repair command'
      using errcode = '22023';
  end if;

  select segment.*
  into v_segment
  from public.dtr_segments segment
  where segment.house_id = p_house_id
    and segment.id = p_segment_id
  for update;

  if not found then
    raise exception 'Attendance segment was not found'
      using errcode = 'P0002';
  end if;

  v_fingerprint := md5(jsonb_build_array(
    'MAINTENANCE_REPAIR',
    p_house_id,
    p_segment_id,
    p_reason,
    p_time_in,
    p_time_out,
    p_expected_value_revision
  )::text);

  -- The private engine owns bridge bootstrap, stale revision enforcement,
  -- employee serialization, generation, projection, and idempotency.
  v_result := public.hr_apply_attendance_producer_mutation(
    p_house_id => p_house_id,
    p_employee_id => v_segment.employee_id,
    p_producer_namespace => 'MAINTENANCE_REPAIR_V1',
    p_operation_id => p_operation_id,
    p_request_fingerprint => v_fingerprint,
    p_mutation_kind => 'MANUAL_UPDATE',
    p_segment_id => p_segment_id,
    p_time_in => p_time_in,
    p_time_out => p_time_out,
    p_expected_value_revision => p_expected_value_revision
  );

  update public.hr_attendance_mutation_operations
  set outcome = outcome || jsonb_build_object(
        'repairReason', btrim(p_reason),
        'repairPath', 'ADMIN_BREAK_GLASS'
      )
  where house_id = p_house_id
    and producer_namespace = 'MAINTENANCE_REPAIR_V1'
    and operation_id = btrim(p_operation_id);

  select operation.outcome
  into v_result
  from public.hr_attendance_mutation_operations operation
  where operation.house_id = p_house_id
    and operation.producer_namespace = 'MAINTENANCE_REPAIR_V1'
    and operation.operation_id = btrim(p_operation_id);

  return v_result;
end
$function$;

revoke all on function public.hr_apply_attendance_time_repair(
  uuid, uuid, text, text, timestamptz, timestamptz, bigint
) from public, anon, authenticated, service_role;

comment on function public.hr_apply_attendance_time_repair(
  uuid, uuid, text, text, timestamptz, timestamptz, bigint
) is
  'Gate-B administrative maintenance command. Owner/admin SQL only; records operation identity and reason while preserving canonical revision/generation/projection rules.';

notify pgrst, 'reload schema';
commit;
