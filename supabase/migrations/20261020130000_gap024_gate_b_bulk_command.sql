-- GAP-024 Gate B authenticated bulk replacement command.
-- Replaces one employee/day atomically through canonical attendance authority.
begin;

create or replace function public.hr_attendance_bootstrap_unattributed_segment(
  p_house_id uuid,
  p_segment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_segment public.dtr_segments%rowtype;
  v_fact_id uuid;
begin
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

  if v_segment.canonical_fact_id is not null then
    return v_segment.canonical_fact_id;
  end if;

  v_fact_id := gen_random_uuid();

  insert into public.hr_attendance_facts (
    id, house_id, employee_id, is_active,
    current_value_revision, evidence_basis_revision
  )
  values (
    v_fact_id, p_house_id, v_segment.employee_id, true, 1, 1
  );

  insert into public.hr_attendance_fact_revisions (
    house_id, fact_id, employee_id, revision, predecessor_revision,
    dtr_segment_id, work_date, time_in, time_out,
    hours_worked, overtime_minutes, source, status
  )
  values (
    p_house_id, v_fact_id, v_segment.employee_id, 1, null,
    null, v_segment.work_date, v_segment.time_in, v_segment.time_out,
    v_segment.hours_worked, v_segment.overtime_minutes,
    v_segment.source, v_segment.status
  );

  insert into public.hr_attendance_evidence_frames (
    house_id, fact_id, employee_id, evidence_basis_revision,
    predecessor_revision, semantic_completion_mode, is_sealed
  )
  values (
    p_house_id, v_fact_id, v_segment.employee_id, 1, null,
    case when v_segment.time_out is null then 'OPEN' else 'COMPLETED' end,
    false
  );

  update public.hr_attendance_evidence_frames
  set is_sealed = true,
      sealed_at = now()
  where house_id = p_house_id
    and fact_id = v_fact_id
    and employee_id = v_segment.employee_id
    and evidence_basis_revision = 1;

  update public.dtr_segments
  set canonical_fact_id = v_fact_id
  where house_id = p_house_id
    and id = p_segment_id
    and employee_id = v_segment.employee_id;

  -- Persist the initial UNATTRIBUTED authority pair before the caller may retire it.
  perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

  return v_fact_id;
end
$function$;

create or replace function public.hr_replace_bulk_attendance_day(
  p_house_id uuid,
  p_employee_id uuid,
  p_work_date date,
  p_operation_id text,
  p_segments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_employee_branch_id uuid;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_segment public.dtr_segments%rowtype;
  v_old_fact public.hr_attendance_facts%rowtype;
  v_item jsonb;
  v_time_in timestamptz;
  v_time_out timestamptz;
  v_new_segment_id uuid;
  v_new_fact_id uuid;
  v_created_fact_ids jsonb := '[]'::jsonb;
  v_first_in timestamptz := null;
  v_last_out timestamptz := null;
  v_generation bigint;
  v_segment_count integer := 0;
  v_result jsonb;
begin
  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_house_id is null
    or p_employee_id is null
    or p_work_date is null
    or p_operation_id is null
    or length(btrim(p_operation_id)) = 0
    or p_segments is null
    or jsonb_typeof(p_segments) <> 'array'
    or jsonb_array_length(p_segments) > 2 then
    raise exception 'Invalid bulk attendance replacement command'
      using errcode = '22023';
  end if;

  select employee.branch_id
  into v_employee_branch_id
  from public.employees employee
  where employee.house_id = p_house_id
    and employee.id = p_employee_id
  for key share;
  if not found then
    raise exception 'Attendance mutation requires an employee in the requested House'
      using errcode = '23503';
  end if;

  if not public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id) then
    if v_employee_branch_id is null
      or not public.hr_attendance_actor_can_write_branch(
        p_house_id,
        v_entity_id,
        v_employee_branch_id
      ) then
      raise exception 'Bulk attendance target is outside caller write scope'
        using errcode = '42501';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || p_employee_id::text,
      0
    )
  );

  v_fingerprint := md5(jsonb_build_array(
    'BULK_REPLACE_DAY',
    p_house_id,
    p_employee_id,
    p_work_date,
    p_segments
  )::text);

  insert into public.hr_attendance_mutation_operations (
    house_id, producer_namespace, operation_id,
    employee_id, request_fingerprint
  )
  values (
    p_house_id, 'BULK_IMPORT_V1', btrim(p_operation_id),
    p_employee_id, v_fingerprint
  )
  on conflict (house_id, producer_namespace, operation_id) do nothing;

  select operation.request_fingerprint, operation.outcome
  into v_existing_fingerprint, v_existing_outcome
  from public.hr_attendance_mutation_operations operation
  where operation.house_id = p_house_id
    and operation.producer_namespace = 'BULK_IMPORT_V1'
    and operation.operation_id = btrim(p_operation_id)
  for update;

  if v_existing_fingerprint is distinct from v_fingerprint then
    raise exception 'Attendance operation identity was reused with different input'
      using errcode = '23505';
  end if;

  if v_existing_outcome is not null then
    return v_existing_outcome || jsonb_build_object('replayed', true);
  end if;

  -- Canonicalize and retire every predecessor fact before deleting compatibility rows.
  for v_segment in
    select segment.*
    from public.dtr_segments segment
    where segment.house_id = p_house_id
      and segment.employee_id = p_employee_id
      and segment.work_date = p_work_date
    order by segment.id
    for update
  loop
    v_new_fact_id := public.hr_attendance_bootstrap_unattributed_segment(
      p_house_id,
      v_segment.id
    );

    select fact.*
    into v_old_fact
    from public.hr_attendance_facts fact
    where fact.house_id = p_house_id
      and fact.id = v_new_fact_id
      and fact.employee_id = p_employee_id
    for update;

    if not found then
      raise exception 'Canonical attendance fact is missing'
        using errcode = '55000';
    end if;

    if not exists (
      select 1
      from public.hr_attendance_authorization_history history
      where history.house_id = p_house_id
        and history.fact_id = v_old_fact.id
        and history.employee_id = p_employee_id
        and history.value_revision = v_old_fact.current_value_revision
        and history.evidence_basis_revision = v_old_fact.evidence_basis_revision
    ) then
      perform public.hr_rebuild_attendance_authorization_projection(p_house_id);
    end if;

    update public.hr_attendance_facts
    set is_active = false,
        updated_at = now()
    where house_id = p_house_id
      and id = v_old_fact.id
      and employee_id = p_employee_id
      and is_active;
  end loop;

  delete from public.dtr_segments
  where house_id = p_house_id
    and employee_id = p_employee_id
    and work_date = p_work_date;

  for v_item in
    select value from jsonb_array_elements(p_segments)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or nullif(v_item ->> 'timeIn', '') is null
      or nullif(v_item ->> 'timeOut', '') is null then
      raise exception 'Bulk attendance segments require timeIn and timeOut'
        using errcode = '22023';
    end if;

    begin
      v_time_in := (v_item ->> 'timeIn')::timestamptz;
      v_time_out := (v_item ->> 'timeOut')::timestamptz;
    exception when others then
      raise exception 'Bulk attendance segment timestamps are invalid'
        using errcode = '22023';
    end;

    if v_time_out <= v_time_in
      or (v_time_in at time zone 'Asia/Manila')::date <> p_work_date then
      raise exception 'Bulk attendance segment is outside the requested work date or has invalid ordering'
        using errcode = '22023';
    end if;

    v_new_segment_id := gen_random_uuid();
    v_new_fact_id := gen_random_uuid();

    insert into public.dtr_segments (
      id, house_id, employee_id, work_date,
      time_in, time_out, hours_worked, overtime_minutes,
      source, status, canonical_fact_id
    )
    values (
      v_new_segment_id, p_house_id, p_employee_id, p_work_date,
      v_time_in, v_time_out, null, 0,
      'bulk', 'closed', null
    );

    insert into public.hr_attendance_facts (
      id, house_id, employee_id, is_active,
      current_value_revision, evidence_basis_revision
    )
    values (v_new_fact_id, p_house_id, p_employee_id, true, 1, 1);

    insert into public.hr_attendance_fact_revisions (
      house_id, fact_id, employee_id, revision, predecessor_revision,
      dtr_segment_id, work_date, time_in, time_out,
      hours_worked, overtime_minutes, source, status
    )
    values (
      p_house_id, v_new_fact_id, p_employee_id, 1, null,
      null, p_work_date, v_time_in, v_time_out,
      null, 0, 'bulk', 'closed'
    );

    -- Bulk without explicit actual-attendance provenance is deliberately UNATTRIBUTED.
    insert into public.hr_attendance_evidence_frames (
      house_id, fact_id, employee_id, evidence_basis_revision,
      predecessor_revision, semantic_completion_mode, is_sealed
    )
    values (
      p_house_id, v_new_fact_id, p_employee_id, 1,
      null, 'COMPLETED', false
    );

    update public.hr_attendance_evidence_frames
    set is_sealed = true,
        sealed_at = now()
    where house_id = p_house_id
      and fact_id = v_new_fact_id
      and employee_id = p_employee_id
      and evidence_basis_revision = 1;

    update public.dtr_segments
    set canonical_fact_id = v_new_fact_id
    where house_id = p_house_id
      and id = v_new_segment_id
      and employee_id = p_employee_id;

    v_created_fact_ids := v_created_fact_ids || jsonb_build_array(v_new_fact_id);
    v_segment_count := v_segment_count + 1;
    if v_first_in is null or v_time_in < v_first_in then
      v_first_in := v_time_in;
    end if;
    if v_last_out is null or v_time_out > v_last_out then
      v_last_out := v_time_out;
    end if;
  end loop;

  insert into public.dtr_entries (
    employee_id, work_date, time_in, time_out
  )
  values (
    p_employee_id, p_work_date, v_first_in, v_last_out
  )
  on conflict (employee_id, work_date)
  do update set
    time_in = excluded.time_in,
    time_out = excluded.time_out;

  v_generation := public.hr_attendance_bump_employee_generation(
    p_house_id,
    p_employee_id
  );
  perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

  v_result := jsonb_build_object(
    'status', 'applied',
    'mutationKind', 'BULK_REPLACE_DAY',
    'employeeId', p_employee_id,
    'workDate', p_work_date,
    'segmentCount', v_segment_count,
    'factIds', v_created_fact_ids,
    'employeeGeneration', v_generation,
    'replayed', false
  );

  update public.hr_attendance_mutation_operations
  set outcome = v_result,
      completed_at = now()
  where house_id = p_house_id
    and producer_namespace = 'BULK_IMPORT_V1'
    and operation_id = btrim(p_operation_id);

  return v_result;
end
$function$;

create or replace function public.hr_upsert_bulk_dtr_entry_summary(
  p_house_id uuid,
  p_employee_id uuid,
  p_work_date date,
  p_time_in timestamptz,
  p_time_out timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_employee_branch_id uuid;
begin
  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select employee.branch_id
  into v_employee_branch_id
  from public.employees employee
  where employee.house_id = p_house_id
    and employee.id = p_employee_id
  for key share;
  if not found then
    raise exception 'DTR summary requires an employee in the requested House'
      using errcode = '23503';
  end if;

  if not public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id) then
    if v_employee_branch_id is null
      or not public.hr_attendance_actor_can_write_branch(
        p_house_id,
        v_entity_id,
        v_employee_branch_id
      ) then
      raise exception 'DTR summary target is outside caller write scope'
        using errcode = '42501';
    end if;
  end if;

  insert into public.dtr_entries (
    employee_id, work_date, time_in, time_out
  )
  values (
    p_employee_id, p_work_date, p_time_in, p_time_out
  )
  on conflict (employee_id, work_date)
  do update set
    time_in = excluded.time_in,
    time_out = excluded.time_out;
end
$function$;

revoke all on function public.hr_upsert_bulk_dtr_entry_summary(
  uuid, uuid, date, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.hr_upsert_bulk_dtr_entry_summary(
  uuid, uuid, date, timestamptz, timestamptz
) to authenticated;

revoke all on function public.hr_attendance_bootstrap_unattributed_segment(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_replace_bulk_attendance_day(
  uuid, uuid, date, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.hr_replace_bulk_attendance_day(
  uuid, uuid, date, text, jsonb
) to authenticated;

comment on function public.hr_replace_bulk_attendance_day(
  uuid, uuid, date, text, jsonb
) is
  'Gate-B authenticated bulk replacement: retires predecessor facts, creates new UNATTRIBUTED facts, updates dtr_entries, and refreshes authorization atomically.';

notify pgrst, 'reload schema';
commit;
