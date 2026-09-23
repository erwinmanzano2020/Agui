-- GAP-024 Gate B kiosk producer command.
-- Moves idempotency, debounce, and IN/OUT action selection into the serialized DB path.
begin;

create or replace function public.hr_attendance_apply_kiosk_scan_locked(
  p_house_id uuid,
  p_employee_id uuid,
  p_branch_id uuid,
  p_device_id uuid,
  p_source_observation_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_last_occurred_at timestamptz;
  v_open_count bigint := 0;
  v_segment public.dtr_segments%rowtype;
  v_fact public.hr_attendance_facts%rowtype;
  v_fact_id uuid;
  v_segment_id uuid;
  v_observation_id uuid;
  v_evidence_id uuid;
  v_next_revision bigint;
  v_next_basis bigint;
  v_generation bigint;
  v_work_date date;
  v_result jsonb;
begin
  if p_source_observation_id is null
    or length(btrim(p_source_observation_id)) = 0
    or p_occurred_at is null then
    raise exception 'Kiosk scan requires stable source identity and occurrence time'
      using errcode = '22023';
  end if;

  select max(candidate.occurred_at)
  into v_last_occurred_at
  from (
    select observation.occurred_at
    from public.hr_attendance_observations observation
    where observation.house_id = p_house_id
      and observation.employee_id = p_employee_id
      and observation.source_namespace = 'KIOSK_SCAN_V1'
    union all
    select event.occurred_at
    from public.hr_kiosk_events event
    where event.house_id = p_house_id
      and event.employee_id = p_employee_id
      and event.event_type in ('clock_in', 'clock_out')
  ) candidate;

  if v_last_occurred_at is not null
    and abs(extract(epoch from (p_occurred_at - v_last_occurred_at))) < 10 then
    return jsonb_build_object(
      'status', 'applied',
      'mutationKind', 'KIOSK_SCAN',
      'action', 'debounced',
      'segmentId', null,
      'factId', null,
      'valueRevision', null,
      'evidenceBasisRevision', null,
      'workDate', (p_occurred_at at time zone 'Asia/Manila')::date,
      'multipleOpenSegments', false,
      'replayed', false
    );
  end if;

  insert into public.hr_kiosk_events (
    house_id, branch_id, device_id, employee_id,
    event_type, occurred_at, metadata
  )
  values (
    p_house_id, p_branch_id, p_device_id, p_employee_id,
    'scan', p_occurred_at,
    jsonb_build_object('clientId', p_source_observation_id)
  );

  select count(*)
  into v_open_count
  from public.dtr_segments segment
  where segment.house_id = p_house_id
    and segment.employee_id = p_employee_id
    and segment.status = 'open'
    and segment.time_out is null;

  select segment.*
  into v_segment
  from public.dtr_segments segment
  where segment.house_id = p_house_id
    and segment.employee_id = p_employee_id
    and segment.status = 'open'
    and segment.time_out is null
  order by segment.time_in desc nulls last, segment.id desc
  limit 1
  for update;

  v_work_date := (p_occurred_at at time zone 'Asia/Manila')::date;

  if not found then
    v_segment_id := gen_random_uuid();
    v_fact_id := gen_random_uuid();
    v_observation_id := gen_random_uuid();
    v_evidence_id := gen_random_uuid();

    insert into public.dtr_segments (
      id, house_id, employee_id, work_date,
      time_in, time_out, hours_worked, overtime_minutes,
      source, status, canonical_fact_id
    )
    values (
      v_segment_id, p_house_id, p_employee_id, v_work_date,
      p_occurred_at, null, null, 0,
      'system', 'open', null
    );

    insert into public.hr_attendance_facts (
      id, house_id, employee_id, is_active,
      current_value_revision, evidence_basis_revision
    )
    values (v_fact_id, p_house_id, p_employee_id, true, 1, 1);

    insert into public.hr_attendance_fact_revisions (
      house_id, fact_id, employee_id, revision, predecessor_revision,
      dtr_segment_id, work_date, time_in, time_out,
      hours_worked, overtime_minutes, source, status
    )
    values (
      p_house_id, v_fact_id, p_employee_id, 1, null,
      null, v_work_date, p_occurred_at, null,
      null, 0, 'system', 'open'
    );

    insert into public.hr_attendance_evidence_frames (
      house_id, fact_id, employee_id, evidence_basis_revision,
      predecessor_revision, semantic_completion_mode, is_sealed
    )
    values (p_house_id, v_fact_id, p_employee_id, 1, null, 'OPEN', false);

    insert into public.hr_attendance_observations (
      id, house_id, employee_id, source_namespace,
      source_observation_id, occurred_at
    )
    values (
      v_observation_id, p_house_id, p_employee_id,
      'KIOSK_SCAN_V1', btrim(p_source_observation_id), p_occurred_at
    );

    insert into public.hr_attendance_evidence (
      id, house_id, employee_id, observation_id,
      lane, evidence_kind, branch_id,
      integrity_state, integrity_reason_class, sufficiency_state,
      is_integrity_eligible, semantic_revision,
      supersedes_evidence_id, lineage_root_evidence_id,
      source_reference
    )
    values (
      v_evidence_id, p_house_id, p_employee_id, v_observation_id,
      'KIOSK', 'LOGICAL_IN', p_branch_id,
      'ESTABLISHED', 'VALID', 'SUFFICIENT',
      true, 1, null, v_evidence_id,
      p_device_id::text
    );

    insert into public.hr_attendance_fact_evidence (
      house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
    )
    values (p_house_id, v_fact_id, 1, v_evidence_id, p_employee_id);

    update public.hr_attendance_evidence_frames
    set is_sealed = true, sealed_at = now()
    where house_id = p_house_id
      and fact_id = v_fact_id
      and employee_id = p_employee_id
      and evidence_basis_revision = 1;

    update public.dtr_segments
    set canonical_fact_id = v_fact_id
    where house_id = p_house_id
      and id = v_segment_id
      and employee_id = p_employee_id;

    v_generation := public.hr_attendance_bump_employee_generation(
      p_house_id,
      p_employee_id
    );
    perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

    insert into public.hr_kiosk_events (
      house_id, branch_id, device_id, employee_id,
      event_type, occurred_at, metadata
    )
    values (
      p_house_id, p_branch_id, p_device_id, p_employee_id,
      'clock_in', p_occurred_at,
      jsonb_build_object(
        'segmentId', v_segment_id,
        'clientId', p_source_observation_id,
        'multipleOpenSegments', v_open_count > 1
      )
    );

    return jsonb_build_object(
      'status', 'applied',
      'mutationKind', 'KIOSK_SCAN',
      'action', 'clock_in',
      'segmentId', v_segment_id,
      'factId', v_fact_id,
      'valueRevision', 1,
      'evidenceBasisRevision', 1,
      'employeeGeneration', v_generation,
      'workDate', v_work_date,
      'multipleOpenSegments', v_open_count > 1,
      'replayed', false
    );
  end if;

  if v_segment.time_in is not null and p_occurred_at <= v_segment.time_in then
    raise exception 'Kiosk occurrence time is earlier than or equal to open attendance time_in'
      using errcode = '40001';
  end if;

  v_segment_id := v_segment.id;

  if v_segment.canonical_fact_id is null then
    v_fact_id := gen_random_uuid();

    insert into public.hr_attendance_facts (
      id, house_id, employee_id, is_active,
      current_value_revision, evidence_basis_revision
    )
    values (v_fact_id, p_house_id, p_employee_id, true, 1, 1);

    insert into public.hr_attendance_fact_revisions (
      house_id, fact_id, employee_id, revision, predecessor_revision,
      dtr_segment_id, work_date, time_in, time_out,
      hours_worked, overtime_minutes, source, status
    )
    values (
      p_house_id, v_fact_id, p_employee_id, 1, null,
      null, v_segment.work_date, v_segment.time_in, v_segment.time_out,
      v_segment.hours_worked, v_segment.overtime_minutes,
      v_segment.source, v_segment.status
    );

    insert into public.hr_attendance_evidence_frames (
      house_id, fact_id, employee_id, evidence_basis_revision,
      predecessor_revision, semantic_completion_mode, is_sealed
    )
    values (p_house_id, v_fact_id, p_employee_id, 1, null, 'OPEN', false);

    update public.hr_attendance_evidence_frames
    set is_sealed = true, sealed_at = now()
    where house_id = p_house_id
      and fact_id = v_fact_id
      and employee_id = p_employee_id
      and evidence_basis_revision = 1;

    update public.dtr_segments
    set canonical_fact_id = v_fact_id
    where house_id = p_house_id
      and id = v_segment_id
      and employee_id = p_employee_id;

    perform public.hr_rebuild_attendance_authorization_projection(p_house_id);
  else
    v_fact_id := v_segment.canonical_fact_id;
  end if;

  select fact.*
  into v_fact
  from public.hr_attendance_facts fact
  where fact.house_id = p_house_id
    and fact.id = v_fact_id
    and fact.employee_id = p_employee_id
  for update;
  if not found or not v_fact.is_active then
    raise exception 'Canonical attendance fact is missing or retired'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.hr_attendance_authorization_history history
    where history.house_id = p_house_id
      and history.fact_id = v_fact_id
      and history.employee_id = p_employee_id
      and history.value_revision = v_fact.current_value_revision
      and history.evidence_basis_revision = v_fact.evidence_basis_revision
  ) then
    perform public.hr_rebuild_attendance_authorization_projection(p_house_id);
  end if;

  v_next_revision := v_fact.current_value_revision + 1;
  v_next_basis := v_fact.evidence_basis_revision + 1;
  v_observation_id := gen_random_uuid();
  v_evidence_id := gen_random_uuid();

  insert into public.hr_attendance_fact_revisions (
    house_id, fact_id, employee_id, revision, predecessor_revision,
    dtr_segment_id, work_date, time_in, time_out,
    hours_worked, overtime_minutes, source, status
  )
  values (
    p_house_id, v_fact_id, p_employee_id,
    v_next_revision, v_fact.current_value_revision,
    null, v_segment.work_date, v_segment.time_in, p_occurred_at,
    v_segment.hours_worked, v_segment.overtime_minutes,
    v_segment.source, 'closed'
  );

  insert into public.hr_attendance_evidence_frames (
    house_id, fact_id, employee_id, evidence_basis_revision,
    predecessor_revision, semantic_completion_mode, is_sealed
  )
  values (
    p_house_id, v_fact_id, p_employee_id,
    v_next_basis, v_fact.evidence_basis_revision, 'COMPLETED', false
  );

  insert into public.hr_attendance_fact_evidence (
    house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
  )
  select
    existing.house_id,
    existing.fact_id,
    v_next_basis,
    existing.evidence_id,
    existing.employee_id
  from public.hr_attendance_fact_evidence existing
  where existing.house_id = p_house_id
    and existing.fact_id = v_fact_id
    and existing.employee_id = p_employee_id
    and existing.evidence_basis_revision = v_fact.evidence_basis_revision
  order by existing.evidence_id;

  insert into public.hr_attendance_observations (
    id, house_id, employee_id, source_namespace,
    source_observation_id, occurred_at
  )
  values (
    v_observation_id, p_house_id, p_employee_id,
    'KIOSK_SCAN_V1', btrim(p_source_observation_id), p_occurred_at
  );

  insert into public.hr_attendance_evidence (
    id, house_id, employee_id, observation_id,
    lane, evidence_kind, branch_id,
    integrity_state, integrity_reason_class, sufficiency_state,
    is_integrity_eligible, semantic_revision,
    supersedes_evidence_id, lineage_root_evidence_id,
    source_reference
  )
  values (
    v_evidence_id, p_house_id, p_employee_id, v_observation_id,
    'KIOSK', 'LOGICAL_OUT', p_branch_id,
    'ESTABLISHED', 'VALID', 'SUFFICIENT',
    true, 1, null, v_evidence_id,
    p_device_id::text
  );

  insert into public.hr_attendance_fact_evidence (
    house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
  )
  values (
    p_house_id, v_fact_id, v_next_basis, v_evidence_id, p_employee_id
  );

  update public.hr_attendance_evidence_frames
  set is_sealed = true, sealed_at = now()
  where house_id = p_house_id
    and fact_id = v_fact_id
    and employee_id = p_employee_id
    and evidence_basis_revision = v_next_basis;

  update public.dtr_segments
  set time_out = p_occurred_at,
      status = 'closed'
  where house_id = p_house_id
    and id = v_segment_id
    and employee_id = p_employee_id;

  update public.hr_attendance_facts
  set current_value_revision = v_next_revision,
      evidence_basis_revision = v_next_basis,
      updated_at = now()
  where house_id = p_house_id
    and id = v_fact_id
    and employee_id = p_employee_id;

  v_generation := public.hr_attendance_bump_employee_generation(
    p_house_id,
    p_employee_id
  );
  perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

  insert into public.hr_kiosk_events (
    house_id, branch_id, device_id, employee_id,
    event_type, occurred_at, metadata
  )
  values (
    p_house_id, p_branch_id, p_device_id, p_employee_id,
    'clock_out', p_occurred_at,
    jsonb_build_object(
      'segmentId', v_segment_id,
      'clientId', p_source_observation_id,
      'multipleOpenSegments', v_open_count > 1
    )
  );

  v_result := jsonb_build_object(
    'status', 'applied',
    'mutationKind', 'KIOSK_SCAN',
    'action', 'clock_out',
    'segmentId', v_segment_id,
    'factId', v_fact_id,
    'valueRevision', v_next_revision,
    'evidenceBasisRevision', v_next_basis,
    'employeeGeneration', v_generation,
    'workDate', v_work_date,
    'multipleOpenSegments', v_open_count > 1,
    'replayed', false
  );
  return v_result;
end
$function$;


create or replace function public.hr_apply_attendance_producer_mutation(
  p_house_id uuid,
  p_employee_id uuid,
  p_producer_namespace text,
  p_operation_id text,
  p_request_fingerprint text,
  p_mutation_kind text,
  p_segment_id uuid default null,
  p_work_date date default null,
  p_time_in timestamptz default null,
  p_time_out timestamptz default null,
  p_actual_branch_id uuid default null,
  p_actor_entity_id uuid default null,
  p_actor_role text default null,
  p_expected_value_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_segment public.dtr_segments%rowtype;
  v_fact public.hr_attendance_facts%rowtype;
  v_fact_id uuid;
  v_segment_id uuid;
  v_evidence_id uuid;
  v_next_revision bigint;
  v_generation bigint;
  v_status text;
  v_completion_mode text;
  v_result jsonb;
begin
  if p_house_id is null
    or p_employee_id is null
    or p_producer_namespace is null
    or length(btrim(p_producer_namespace)) = 0
    or p_operation_id is null
    or length(btrim(p_operation_id)) = 0
    or p_request_fingerprint is null
    or length(btrim(p_request_fingerprint)) = 0
    or p_mutation_kind not in ('MANUAL_CREATE', 'MANUAL_UPDATE', 'KIOSK_SCAN') then
    raise exception 'Invalid attendance mutation command'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || p_employee_id::text,
      0
    )
  );

  perform 1
  from public.employees employee
  where employee.house_id = p_house_id
    and employee.id = p_employee_id
  for key share;
  if not found then
    raise exception 'Attendance mutation requires an employee in the requested House'
      using errcode = '23503';
  end if;

  insert into public.hr_attendance_mutation_operations (
    house_id,
    producer_namespace,
    operation_id,
    employee_id,
    request_fingerprint
  )
  values (
    p_house_id,
    btrim(p_producer_namespace),
    btrim(p_operation_id),
    p_employee_id,
    btrim(p_request_fingerprint)
  )
  on conflict (house_id, producer_namespace, operation_id) do nothing;

  select operation.request_fingerprint, operation.outcome
  into v_existing_fingerprint, v_existing_outcome
  from public.hr_attendance_mutation_operations operation
  where operation.house_id = p_house_id
    and operation.producer_namespace = btrim(p_producer_namespace)
    and operation.operation_id = btrim(p_operation_id)
  for update;

  if v_existing_fingerprint is distinct from btrim(p_request_fingerprint) then
    raise exception 'Attendance operation identity was reused with different input'
      using errcode = '23505';
  end if;

  if v_existing_outcome is not null then
    return v_existing_outcome || jsonb_build_object('replayed', true);
  end if;

  if p_mutation_kind = 'KIOSK_SCAN' then
    if p_segment_id is null or p_actual_branch_id is null or p_time_in is null then
      raise exception 'Kiosk scan requires device, branch, and occurrence time'
        using errcode = '22023';
    end if;

    v_result := public.hr_attendance_apply_kiosk_scan_locked(
      p_house_id,
      p_employee_id,
      p_actual_branch_id,
      p_segment_id,
      p_operation_id,
      p_time_in
    );
    v_fact_id := nullif(v_result ->> 'factId', '')::uuid;

    update public.hr_attendance_mutation_operations
    set outcome = v_result,
        fact_id = v_fact_id,
        value_revision = nullif(v_result ->> 'valueRevision', '')::bigint,
        evidence_basis_revision = nullif(v_result ->> 'evidenceBasisRevision', '')::bigint,
        completed_at = now()
    where house_id = p_house_id
      and producer_namespace = btrim(p_producer_namespace)
      and operation_id = btrim(p_operation_id);

    return v_result;
  end if;

  if p_mutation_kind = 'MANUAL_CREATE' then
    if p_work_date is null or p_time_in is null or p_actual_branch_id is null
      or p_actor_entity_id is null or p_actor_role is null then
      raise exception 'Manual attendance creation requires value and provenance input'
        using errcode = '22023';
    end if;
    if p_time_out is not null and p_time_out <= p_time_in then
      raise exception 'Manual attendance time_out must be later than time_in'
        using errcode = '22023';
    end if;

    v_status := case when p_time_out is null then 'open' else 'closed' end;
    v_completion_mode := case when p_time_out is null then 'OPEN' else 'COMPLETED' end;
    v_segment_id := gen_random_uuid();
    v_fact_id := gen_random_uuid();
    v_evidence_id := gen_random_uuid();

    insert into public.dtr_segments (
      id, house_id, employee_id, work_date,
      time_in, time_out, hours_worked, overtime_minutes,
      source, status, canonical_fact_id
    )
    values (
      v_segment_id, p_house_id, p_employee_id, p_work_date,
      p_time_in, p_time_out, null, 0,
      'manual', v_status, null
    );

    insert into public.hr_attendance_facts (
      id, house_id, employee_id, is_active,
      current_value_revision, evidence_basis_revision
    )
    values (v_fact_id, p_house_id, p_employee_id, true, 1, 1);

    insert into public.hr_attendance_fact_revisions (
      house_id, fact_id, employee_id, revision, predecessor_revision,
      dtr_segment_id, work_date, time_in, time_out,
      hours_worked, overtime_minutes, source, status
    )
    values (
      p_house_id, v_fact_id, p_employee_id, 1, null,
      null, p_work_date, p_time_in, p_time_out,
      null, 0, 'manual', v_status
    );

    insert into public.hr_attendance_evidence_frames (
      house_id, fact_id, employee_id, evidence_basis_revision,
      predecessor_revision, semantic_completion_mode, is_sealed
    )
    values (
      p_house_id, v_fact_id, p_employee_id, 1,
      null, v_completion_mode, false
    );

    insert into public.hr_attendance_evidence (
      id, house_id, employee_id, observation_id,
      lane, evidence_kind, branch_id,
      integrity_state, integrity_reason_class, sufficiency_state,
      is_integrity_eligible, semantic_revision,
      supersedes_evidence_id, lineage_root_evidence_id,
      asserted_by_entity_id, asserted_by_house_role,
      authorization_namespace, authorization_reference,
      asserted_at, source_reference
    )
    values (
      v_evidence_id, p_house_id, p_employee_id, null,
      'MANUAL_ADMIN', 'EXPLICIT_BRANCH', p_actual_branch_id,
      'ESTABLISHED', 'VALID', 'SUFFICIENT',
      true, 1,
      null, v_evidence_id,
      p_actor_entity_id, p_actor_role,
      'GATE_B_MANUAL_CREATE', btrim(p_operation_id),
      now(), v_segment_id::text
    );

    insert into public.hr_attendance_fact_evidence (
      house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
    )
    values (p_house_id, v_fact_id, 1, v_evidence_id, p_employee_id);

    update public.hr_attendance_evidence_frames
    set is_sealed = true, sealed_at = now()
    where house_id = p_house_id
      and fact_id = v_fact_id
      and employee_id = p_employee_id
      and evidence_basis_revision = 1;

    update public.dtr_segments
    set canonical_fact_id = v_fact_id
    where house_id = p_house_id
      and id = v_segment_id
      and employee_id = p_employee_id;

    v_generation := public.hr_attendance_bump_employee_generation(
      p_house_id,
      p_employee_id
    );
    perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

    v_result := jsonb_build_object(
      'status', 'applied',
      'mutationKind', p_mutation_kind,
      'segmentId', v_segment_id,
      'factId', v_fact_id,
      'valueRevision', 1,
      'evidenceBasisRevision', 1,
      'employeeGeneration', v_generation
    );
  else
    if p_segment_id is null or p_time_in is null then
      raise exception 'Manual attendance update requires segment and time input'
        using errcode = '22023';
    end if;
    if p_time_out is not null and p_time_out <= p_time_in then
      raise exception 'Manual attendance time_out must be later than time_in'
        using errcode = '22023';
    end if;

    select segment.*
    into v_segment
    from public.dtr_segments segment
    where segment.house_id = p_house_id
      and segment.id = p_segment_id
      and segment.employee_id = p_employee_id
    for update;
    if not found then
      raise exception 'Attendance segment was not found'
        using errcode = 'P0002';
    end if;

    v_status := case when p_time_out is null then 'open' else 'closed' end;

    if v_segment.canonical_fact_id is null then
      if p_expected_value_revision is not null then
        raise exception 'Unbridged legacy attendance cannot satisfy a canonical revision token'
          using errcode = '40001';
      end if;

      v_fact_id := gen_random_uuid();
      insert into public.hr_attendance_facts (
        id, house_id, employee_id, is_active,
        current_value_revision, evidence_basis_revision
      )
      values (v_fact_id, p_house_id, p_employee_id, true, 1, 1);

      insert into public.hr_attendance_fact_revisions (
        house_id, fact_id, employee_id, revision, predecessor_revision,
        dtr_segment_id, work_date, time_in, time_out,
        hours_worked, overtime_minutes, source, status
      )
      values (
        p_house_id, v_fact_id, p_employee_id, 1, null,
        null, v_segment.work_date, v_segment.time_in, v_segment.time_out,
        v_segment.hours_worked, v_segment.overtime_minutes,
        v_segment.source, v_segment.status
      );

      insert into public.hr_attendance_evidence_frames (
        house_id, fact_id, employee_id, evidence_basis_revision,
        predecessor_revision, semantic_completion_mode, is_sealed
      )
      values (
        p_house_id, v_fact_id, p_employee_id, 1, null,
        case when v_segment.time_out is null then 'OPEN' else 'COMPLETED' end,
        false
      );

      update public.hr_attendance_evidence_frames
      set is_sealed = true, sealed_at = now()
      where house_id = p_house_id
        and fact_id = v_fact_id
        and employee_id = p_employee_id
        and evidence_basis_revision = 1;

      update public.dtr_segments
      set canonical_fact_id = v_fact_id
      where house_id = p_house_id
        and id = p_segment_id
        and employee_id = p_employee_id;

      -- Gate-A activation requires the original pair to be durable history before
      -- revision 2 can become current.
      perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

      select fact.*
      into v_fact
      from public.hr_attendance_facts fact
      where fact.house_id = p_house_id
        and fact.id = v_fact_id
        and fact.employee_id = p_employee_id
      for update;
    else
      v_fact_id := v_segment.canonical_fact_id;

      select fact.*
      into v_fact
      from public.hr_attendance_facts fact
      where fact.house_id = p_house_id
        and fact.id = v_fact_id
        and fact.employee_id = p_employee_id
      for update;
      if not found or not v_fact.is_active then
        raise exception 'Canonical attendance fact is missing or retired'
          using errcode = '55000';
      end if;

      if p_expected_value_revision is null
        or p_expected_value_revision <> v_fact.current_value_revision then
        raise exception 'Attendance fact revision is stale'
          using errcode = '40001';
      end if;
    end if;

    v_next_revision := v_fact.current_value_revision + 1;

    insert into public.hr_attendance_fact_revisions (
      house_id, fact_id, employee_id, revision, predecessor_revision,
      dtr_segment_id, work_date, time_in, time_out,
      hours_worked, overtime_minutes, source, status
    )
    values (
      p_house_id, v_fact_id, p_employee_id,
      v_next_revision, v_fact.current_value_revision,
      null, v_segment.work_date, p_time_in, p_time_out,
      v_segment.hours_worked, v_segment.overtime_minutes,
      v_segment.source, v_status
    );

    update public.dtr_segments
    set time_in = p_time_in,
        time_out = p_time_out,
        status = v_status
    where house_id = p_house_id
      and id = p_segment_id
      and employee_id = p_employee_id;

    update public.hr_attendance_facts
    set current_value_revision = v_next_revision,
        updated_at = now()
    where house_id = p_house_id
      and id = v_fact_id
      and employee_id = p_employee_id;

    v_generation := public.hr_attendance_bump_employee_generation(
      p_house_id,
      p_employee_id
    );
    perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

    v_result := jsonb_build_object(
      'status', 'applied',
      'mutationKind', p_mutation_kind,
      'segmentId', p_segment_id,
      'factId', v_fact_id,
      'valueRevision', v_next_revision,
      'evidenceBasisRevision', v_fact.evidence_basis_revision,
      'employeeGeneration', v_generation
    );
  end if;

  update public.hr_attendance_mutation_operations
  set outcome = v_result,
      fact_id = v_fact_id,
      value_revision = (v_result ->> 'valueRevision')::bigint,
      evidence_basis_revision = (v_result ->> 'evidenceBasisRevision')::bigint,
      completed_at = now()
  where house_id = p_house_id
    and producer_namespace = btrim(p_producer_namespace)
    and operation_id = btrim(p_operation_id);

  return v_result;
end
$function$;


create or replace function public.hr_apply_kiosk_attendance_scan(
  p_house_id uuid,
  p_branch_id uuid,
  p_device_id uuid,
  p_employee_id uuid,
  p_operation_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_fingerprint text;
begin
  if p_operation_id is null
    or length(btrim(p_operation_id)) = 0
    or p_occurred_at is null then
    raise exception 'Kiosk scan requires stable operation identity and occurrence time'
      using errcode = '22023';
  end if;

  perform 1
  from public.hr_kiosk_devices device
  where device.id = p_device_id
    and device.house_id = p_house_id
    and device.branch_id = p_branch_id
    and device.is_active
  for key share;
  if not found then
    raise exception 'Kiosk device context is inactive or mismatched'
      using errcode = '42501';
  end if;

  v_fingerprint := md5(jsonb_build_array(
    'KIOSK_SCAN',
    p_house_id,
    p_branch_id,
    p_device_id,
    p_employee_id,
    btrim(p_operation_id),
    p_occurred_at
  )::text);

  return public.hr_apply_attendance_producer_mutation(
    p_house_id => p_house_id,
    p_employee_id => p_employee_id,
    p_producer_namespace => 'KIOSK_SCAN_V1',
    p_operation_id => btrim(p_operation_id),
    p_request_fingerprint => v_fingerprint,
    p_mutation_kind => 'KIOSK_SCAN',
    p_segment_id => p_device_id,
    p_time_in => p_occurred_at,
    p_actual_branch_id => p_branch_id
  );
end
$function$;

revoke all on function public.hr_attendance_apply_kiosk_scan_locked(
  uuid, uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.hr_apply_kiosk_attendance_scan(
  uuid, uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.hr_apply_kiosk_attendance_scan(
  uuid, uuid, uuid, uuid, text, timestamptz
) to service_role;

comment on function public.hr_apply_kiosk_attendance_scan(
  uuid, uuid, uuid, uuid, text, timestamptz
) is
  'Gate-B kiosk producer wrapper: validates active device context and delegates replay/debounce/IN-OUT choice to the canonical serialized mutation engine.';


notify pgrst, 'reload schema';
commit;
