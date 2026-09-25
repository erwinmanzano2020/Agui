-- Historical Daily DTR Write P1 correction commands + legacy manual-write cutover.
begin;

create or replace function public.hr_attendance_p1_broad_role_label(
  p_house_id uuid,
  p_entity_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_role text;
begin
  if p_house_id is null or p_entity_id is null then
    return null;
  end if;

  if public.current_entity_is_gm()
    and public.current_entity_id() = p_entity_id then
    return 'GAME_MASTER';
  end if;

  select hr.role
  into v_role
  from public.house_roles hr
  where hr.house_id = p_house_id
    and hr.entity_id = p_entity_id
    and lower(btrim(hr.role)) in (
      'house_owner', 'business_owner',
      'house_manager', 'business_admin', 'business_manager'
    )
  order by
    case
      when lower(btrim(hr.role)) in ('house_owner', 'business_owner') then 1
      else 2
    end,
    hr.role
  limit 1;

  return v_role;
end
$function$;

-- Private canonical P1 finalization primitive. Public wrappers own authorization,
-- idempotency, case locking, stale checks and HR-4 decisions before calling this helper.
create or replace function public.hr_apply_attendance_p1_finalization(
  p_house_id uuid,
  p_employee_id uuid,
  p_mode text,
  p_case_id uuid,
  p_fact_id uuid,
  p_work_date date,
  p_time_in timestamptz,
  p_time_out timestamptz,
  p_target_branch_id uuid,
  p_actor_entity_id uuid,
  p_actor_role text,
  p_base_value_revision bigint,
  p_base_evidence_basis_revision bigint,
  p_base_evidence_basis_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_fact public.hr_attendance_facts%rowtype;
  v_revision public.hr_attendance_fact_revisions%rowtype;
  v_projection public.hr_attendance_authorization_projection%rowtype;
  v_segment public.dtr_segments%rowtype;
  v_current_frame public.hr_attendance_evidence_frames%rowtype;
  v_new_value_revision bigint;
  v_new_evidence_basis_revision bigint;
  v_new_evidence_id uuid;
  v_new_observation_id uuid;
  v_new_fact_id uuid;
  v_new_segment_id uuid;
  v_status text;
  v_value_changed boolean;
  v_location_changed boolean;
  v_generation bigint;
begin
  if p_house_id is null or p_employee_id is null or p_case_id is null
    or p_mode not in ('CORRECTION', 'REMEDIATION_CREATE')
    or p_work_date is null or p_time_in is null
    or (p_time_out is not null and p_time_out <= p_time_in)
    or p_actor_entity_id is null or p_actor_role is null then
    raise exception 'Invalid P1 finalization input' using errcode = '22023';
  end if;

  v_status := case when p_time_out is null then 'open' else 'closed' end;

  if p_mode = 'REMEDIATION_CREATE' then
    if p_fact_id is not null or p_target_branch_id is null then
      raise exception 'Invalid P1 remediation-create finalization input' using errcode = '22023';
    end if;

    v_new_segment_id := gen_random_uuid();
    v_new_fact_id := gen_random_uuid();
    v_new_observation_id := gen_random_uuid();
    v_new_evidence_id := gen_random_uuid();

    insert into public.dtr_segments (
      id, house_id, employee_id, work_date,
      time_in, time_out, hours_worked, overtime_minutes,
      source, status, canonical_fact_id
    )
    values (
      v_new_segment_id, p_house_id, p_employee_id, p_work_date,
      p_time_in, p_time_out, null, 0,
      'manual', v_status, null
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
      null, p_work_date, p_time_in, p_time_out,
      null, 0, 'manual', v_status
    );

    insert into public.hr_attendance_evidence_frames (
      house_id, fact_id, employee_id, evidence_basis_revision,
      predecessor_revision, semantic_completion_mode, is_sealed
    )
    values (
      p_house_id, v_new_fact_id, p_employee_id, 1,
      null, case when p_time_out is null then 'OPEN' else 'COMPLETED' end, false
    );

    -- DEC-018 durable observation identity is the remediation case identity, not
    -- employee/date/time or the retry operation identity.
    insert into public.hr_attendance_observations (
      id, house_id, employee_id, source_namespace,
      source_observation_id, occurred_at
    )
    values (
      v_new_observation_id, p_house_id, p_employee_id,
      'P1_MANUAL_REMEDIATION_V1', p_case_id::text, p_time_in
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
      v_new_evidence_id, p_house_id, p_employee_id, v_new_observation_id,
      'MANUAL_ADMIN', 'EXPLICIT_BRANCH', p_target_branch_id,
      'ESTABLISHED', 'VALID', 'SUFFICIENT',
      true, 1, null, v_new_evidence_id,
      p_actor_entity_id, p_actor_role,
      'P1_REMEDIATION_FINALIZE', p_case_id::text,
      now(), v_new_segment_id::text
    );

    insert into public.hr_attendance_fact_evidence (
      house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
    )
    values (p_house_id, v_new_fact_id, 1, v_new_evidence_id, p_employee_id);

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

    v_generation := public.hr_attendance_bump_employee_generation(
      p_house_id, p_employee_id
    );
    perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

    return jsonb_build_object(
      'status', 'FINALIZED',
      'mode', p_mode,
      'factId', v_new_fact_id,
      'segmentId', v_new_segment_id,
      'valueRevision', 1,
      'evidenceBasisRevision', 1,
      'employeeGeneration', v_generation
    );
  end if;

  if p_fact_id is null
    or p_base_value_revision is null
    or p_base_evidence_basis_revision is null
    or p_base_evidence_basis_fingerprint is null then
    raise exception 'Invalid P1 correction finalization input' using errcode = '22023';
  end if;

  select p.*
  into v_projection
  from public.hr_attendance_authorization_projection p
  where p.house_id = p_house_id
    and p.fact_id = p_fact_id
    and p.employee_id = p_employee_id;

  if not found
    or v_projection.value_revision <> p_base_value_revision
    or v_projection.evidence_basis_revision <> p_base_evidence_basis_revision
    or v_projection.evidence_basis_fingerprint is distinct from p_base_evidence_basis_fingerprint then
    raise exception 'P1 correction base is stale' using errcode = '40001';
  end if;

  select r.*
  into v_revision
  from public.hr_attendance_fact_revisions r
  where r.house_id = p_house_id
    and r.fact_id = p_fact_id
    and r.employee_id = p_employee_id
    and r.revision = p_base_value_revision;

  if not found then
    raise exception 'P1 correction fact revision is unavailable' using errcode = '40001';
  end if;

  v_value_changed :=
    v_revision.work_date is distinct from p_work_date
    or v_revision.time_in is distinct from p_time_in
    or v_revision.time_out is distinct from p_time_out;

  v_location_changed :=
    p_target_branch_id is not null
    and p_target_branch_id is distinct from v_projection.active_branch_id;

  if not v_value_changed and not v_location_changed then
    raise exception 'P1 correction proposal has no effective change' using errcode = '22023';
  end if;

  -- Semantic changes follow the approved frame -> fact -> evidence/lineage prefix.
  if v_location_changed then
    select ef.*
    into v_current_frame
    from public.hr_attendance_evidence_frames ef
    where ef.house_id = p_house_id
      and ef.fact_id = p_fact_id
      and ef.employee_id = p_employee_id
      and ef.evidence_basis_revision = p_base_evidence_basis_revision
      and ef.is_sealed
    for update;

    if not found then
      raise exception 'P1 correction evidence base is stale' using errcode = '40001';
    end if;
  end if;

  select f.*
  into v_fact
  from public.hr_attendance_facts f
  where f.house_id = p_house_id
    and f.id = p_fact_id
    and f.employee_id = p_employee_id
    and f.is_active
  for update;

  if not found
    or v_fact.current_value_revision <> p_base_value_revision
    or v_fact.evidence_basis_revision <> p_base_evidence_basis_revision then
    raise exception 'P1 correction fact is stale' using errcode = '40001';
  end if;

  -- Gate-A requires the current authority pair to have durable history before either
  -- pointer advances. Gate-B projection maintenance normally guarantees this; fail
  -- closed rather than inventing history inside the correction transaction.
  if not exists (
    select 1
    from public.hr_attendance_authorization_history h
    where h.house_id = p_house_id
      and h.fact_id = p_fact_id
      and h.employee_id = p_employee_id
      and h.value_revision = p_base_value_revision
      and h.evidence_basis_revision = p_base_evidence_basis_revision
  ) then
    raise exception 'P1 correction requires durable current authorization history'
      using errcode = '55000';
  end if;

  v_new_value_revision := p_base_value_revision;
  v_new_evidence_basis_revision := p_base_evidence_basis_revision;

  if v_value_changed then
    v_new_value_revision := p_base_value_revision + 1;

    insert into public.hr_attendance_fact_revisions (
      house_id, fact_id, employee_id, revision, predecessor_revision,
      dtr_segment_id, work_date, time_in, time_out,
      hours_worked, overtime_minutes, source, status
    )
    values (
      p_house_id, p_fact_id, p_employee_id,
      v_new_value_revision, p_base_value_revision,
      null, p_work_date, p_time_in, p_time_out,
      v_revision.hours_worked, v_revision.overtime_minutes,
      v_revision.source, v_status
    );
  end if;

  if v_location_changed then
    v_new_evidence_basis_revision := p_base_evidence_basis_revision + 1;
    v_new_evidence_id := gen_random_uuid();

    insert into public.hr_attendance_evidence_frames (
      house_id, fact_id, employee_id, evidence_basis_revision,
      predecessor_revision, semantic_completion_mode, is_sealed
    )
    values (
      p_house_id, p_fact_id, p_employee_id, v_new_evidence_basis_revision,
      p_base_evidence_basis_revision,
      case when p_time_out is null then 'OPEN' else 'COMPLETED' end,
      false
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
      v_new_evidence_id, p_house_id, p_employee_id, null,
      'MANUAL_ADMIN', 'EXPLICIT_BRANCH', p_target_branch_id,
      'ESTABLISHED', 'VALID', 'SUFFICIENT',
      true, 1, null, v_new_evidence_id,
      p_actor_entity_id, p_actor_role,
      'P1_CORRECTION_FINALIZE', p_case_id::text,
      now(), p_fact_id::text
    );

    insert into public.hr_attendance_fact_evidence (
      house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
    )
    values (
      p_house_id, p_fact_id, v_new_evidence_basis_revision,
      v_new_evidence_id, p_employee_id
    );

    update public.hr_attendance_evidence_frames
    set is_sealed = true,
        sealed_at = now()
    where house_id = p_house_id
      and fact_id = p_fact_id
      and employee_id = p_employee_id
      and evidence_basis_revision = v_new_evidence_basis_revision;
  end if;

  select s.*
  into v_segment
  from public.dtr_segments s
  where s.house_id = p_house_id
    and s.employee_id = p_employee_id
    and s.canonical_fact_id = p_fact_id
  for update;

  if not found then
    raise exception 'P1 correction requires one compatibility segment' using errcode = '55000';
  end if;

  if v_value_changed then
    update public.dtr_segments
    set work_date = p_work_date,
        time_in = p_time_in,
        time_out = p_time_out,
        status = v_status
    where house_id = p_house_id
      and id = v_segment.id
      and employee_id = p_employee_id
      and canonical_fact_id = p_fact_id;
  end if;

  update public.hr_attendance_facts
  set current_value_revision = v_new_value_revision,
      evidence_basis_revision = v_new_evidence_basis_revision,
      updated_at = now()
  where house_id = p_house_id
    and id = p_fact_id
    and employee_id = p_employee_id;

  v_generation := public.hr_attendance_bump_employee_generation(
    p_house_id, p_employee_id
  );
  perform public.hr_rebuild_attendance_authorization_projection(p_house_id);

  return jsonb_build_object(
    'status', 'FINALIZED',
    'mode', p_mode,
    'factId', p_fact_id,
    'segmentId', v_segment.id,
    'valueRevision', v_new_value_revision,
    'evidenceBasisRevision', v_new_evidence_basis_revision,
    'employeeGeneration', v_generation
  );
end
$function$;

create or replace function public.hr_propose_attendance_correction(
  p_house_id uuid,
  p_fact_id uuid,
  p_operation_id text,
  p_work_date date,
  p_time_in timestamptz,
  p_time_out timestamptz,
  p_target_branch_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_context record;
  v_context_after_lock record;
  v_generation bigint;
  v_kind text;
  v_payroll_impact text;
  v_value_changed boolean;
  v_location_changed boolean;
  v_actor_role text;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_case_id uuid;
  v_base_snapshot jsonb;
  v_proposed_snapshot jsonb;
  v_result jsonb;
begin
  if p_house_id is null or p_fact_id is null
    or p_operation_id is null or length(btrim(p_operation_id)) = 0
    or p_work_date is null or p_time_in is null
    or (p_time_out is not null and p_time_out <= p_time_in)
    or p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Invalid P1 correction proposal' using errcode = '22023';
  end if;

  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_context
  from public.hr_resolve_attendance_fact_write_context(
    p_house_id, p_fact_id, v_entity_id
  );

  if not found then
    return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
  end if;

  v_value_changed :=
    v_context.work_date is distinct from p_work_date
    or v_context.time_in is distinct from p_time_in
    or v_context.time_out is distinct from p_time_out;

  v_location_changed :=
    p_target_branch_id is not null
    and p_target_branch_id is distinct from v_context.active_branch_id;

  if not v_value_changed and not v_location_changed then
    raise exception 'Correction proposal must change a supported attendance value or location'
      using errcode = '22023';
  end if;

  if v_location_changed then
    if not v_context.is_broad_actor then
      return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
    end if;
    if not exists (
      select 1 from public.branches b
      where b.house_id = p_house_id and b.id = p_target_branch_id
    ) or not public.hr_attendance_actor_can_write_branch(
      p_house_id, v_entity_id, p_target_branch_id
    ) then
      return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
    end if;
  end if;

  v_kind := case
    when v_value_changed and v_location_changed then 'COMBINED'
    when v_location_changed then 'LOCATION'
    else 'VALUE_TIME'
  end;

  v_payroll_impact := case
    when v_value_changed then 'PAYROLL_IMPACTING'
    else 'NON_PAYROLL_IMPACTING'
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || v_context.employee_id::text,
      0
    )
  );

  -- Re-resolve after serialization. The pre-lock lookup never authorizes commit.
  select *
  into v_context_after_lock
  from public.hr_resolve_attendance_fact_write_context(
    p_house_id, p_fact_id, v_entity_id
  );

  if not found
    or v_context_after_lock.current_value_revision <> v_context.current_value_revision
    or v_context_after_lock.evidence_basis_revision <> v_context.evidence_basis_revision
    or v_context_after_lock.evidence_basis_fingerprint is distinct from v_context.evidence_basis_fingerprint then
    return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
  end if;

  -- Correction staleness is governed by the fact value CAS and semantic
  -- evidence-basis fingerprint. The employee-wide remediation generation is not a
  -- correction dependency in P1, so do not stale an otherwise valid correction merely
  -- because unrelated same-employee candidate evidence changed.
  v_generation := null;

  v_actor_role := case
    when v_location_changed then
      public.hr_attendance_actor_role_label(p_house_id, v_entity_id, p_target_branch_id)
    when v_context.active_branch_id is not null then
      public.hr_attendance_actor_role_label(p_house_id, v_entity_id, v_context.active_branch_id)
    else
      public.hr_attendance_p1_broad_role_label(p_house_id, v_entity_id)
  end;

  if v_actor_role is null then
    return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
  end if;

  v_base_snapshot := jsonb_build_object(
    'workDate', v_context.work_date,
    'timeIn', v_context.time_in,
    'timeOut', v_context.time_out,
    'hoursWorked', v_context.hours_worked,
    'overtimeMinutes', v_context.overtime_minutes,
    'status', v_context.status,
    'attributionState', v_context.attribution_state,
    'activeBranchId', v_context.active_branch_id
  );

  v_proposed_snapshot := jsonb_build_object(
    'workDate', p_work_date,
    'timeIn', p_time_in,
    'timeOut', p_time_out,
    'targetBranchId', case
      when v_location_changed then p_target_branch_id
      else v_context.active_branch_id
    end
  );

  v_fingerprint := md5(jsonb_build_array(
    'P1_CORRECTION_PROPOSE_V1', p_house_id, p_fact_id,
    p_work_date, p_time_in, p_time_out, p_target_branch_id, btrim(p_reason),
    v_context.current_value_revision,
    v_context.evidence_basis_revision,
    v_context.evidence_basis_fingerprint
  )::text);

  insert into public.hr_attendance_mutation_operations (
    house_id, producer_namespace, operation_id, employee_id, request_fingerprint
  )
  values (
    p_house_id, 'P1_CORRECTION_PROPOSE_V1', btrim(p_operation_id),
    v_context.employee_id, v_fingerprint
  )
  on conflict (house_id, producer_namespace, operation_id) do nothing;

  select op.request_fingerprint, op.outcome
  into v_existing_fingerprint, v_existing_outcome
  from public.hr_attendance_mutation_operations op
  where op.house_id = p_house_id
    and op.producer_namespace = 'P1_CORRECTION_PROPOSE_V1'
    and op.operation_id = btrim(p_operation_id)
  for update;

  if v_existing_fingerprint is distinct from v_fingerprint then
    raise exception 'Attendance operation identity was reused with different input'
      using errcode = '23505';
  end if;

  if v_existing_outcome is not null then
    return v_existing_outcome || jsonb_build_object('replayed', true);
  end if;

  v_case_id := gen_random_uuid();

  insert into public.hr_attendance_correction_cases (
    id, house_id, employee_id, fact_id,
    correction_kind, payroll_impact,
    base_value_revision, base_evidence_basis_revision,
    base_evidence_basis_fingerprint, base_candidate_evidence_generation,
    base_snapshot, proposed_snapshot, reason,
    proposer_entity_id, proposer_role
  )
  values (
    v_case_id, p_house_id, v_context.employee_id, p_fact_id,
    v_kind, v_payroll_impact,
    v_context.current_value_revision, v_context.evidence_basis_revision,
    v_context.evidence_basis_fingerprint, null,
    v_base_snapshot, v_proposed_snapshot, btrim(p_reason),
    v_entity_id, v_actor_role
  );

  v_result := jsonb_build_object(
    'status', 'PROPOSED',
    'caseId', v_case_id,
    'factId', p_fact_id,
    'correctionKind', v_kind,
    'payrollImpact', v_payroll_impact,
    'replayed', false
  );

  update public.hr_attendance_mutation_operations
  set outcome = v_result,
      fact_id = p_fact_id,
      value_revision = v_context.current_value_revision,
      evidence_basis_revision = v_context.evidence_basis_revision,
      completed_at = now()
  where house_id = p_house_id
    and producer_namespace = 'P1_CORRECTION_PROPOSE_V1'
    and operation_id = btrim(p_operation_id);

  return v_result;
end
$function$;

create or replace function public.hr_finalize_attendance_correction(
  p_house_id uuid,
  p_correction_case_id uuid,
  p_operation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_case public.hr_attendance_correction_cases%rowtype;
  v_context record;
  v_generation bigint;
  v_role text;
  v_hr4 jsonb;
  v_hr4_status text;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_result jsonb;
  v_proposed_work_date date;
  v_proposed_time_in timestamptz;
  v_proposed_time_out timestamptz;
  v_target_branch_id uuid;
  v_recomputed_value_changed boolean;
  v_recomputed_location_changed boolean;
  v_recomputed_kind text;
  v_recomputed_payroll_impact text;
begin
  if p_house_id is null or p_correction_case_id is null
    or p_operation_id is null or length(btrim(p_operation_id)) = 0 then
    raise exception 'Invalid P1 correction finalization' using errcode = '22023';
  end if;

  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.hr_attendance_actor_has_any_write_scope(
    p_house_id, v_entity_id
  ) then
    raise exception 'Attendance correction is outside caller House authority'
      using errcode = '42501';
  end if;

  select c.*
  into v_case
  from public.hr_attendance_correction_cases c
  where c.house_id = p_house_id and c.id = p_correction_case_id;

  if not found then
    return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || v_case.employee_id::text,
      0
    )
  );

  v_fingerprint := md5(jsonb_build_array(
    'P1_CORRECTION_FINALIZE_V1', p_house_id, p_correction_case_id
  )::text);

  insert into public.hr_attendance_mutation_operations (
    house_id, producer_namespace, operation_id, employee_id, request_fingerprint
  )
  values (
    p_house_id, 'P1_CORRECTION_FINALIZE_V1', btrim(p_operation_id),
    v_case.employee_id, v_fingerprint
  )
  on conflict (house_id, producer_namespace, operation_id) do nothing;

  select op.request_fingerprint, op.outcome
  into v_existing_fingerprint, v_existing_outcome
  from public.hr_attendance_mutation_operations op
  where op.house_id = p_house_id
    and op.producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
    and op.operation_id = btrim(p_operation_id)
  for update;

  if v_existing_fingerprint is distinct from v_fingerprint then
    raise exception 'Attendance operation identity was reused with different input'
      using errcode = '23505';
  end if;

  if v_existing_outcome is not null then
    return v_existing_outcome || jsonb_build_object('replayed', true);
  end if;

  select c.*
  into v_case
  from public.hr_attendance_correction_cases c
  where c.house_id = p_house_id and c.id = p_correction_case_id
  for update;

  if v_case.lifecycle_status = 'FINALIZED' then
    v_result := jsonb_build_object('status', 'ALREADY_FINALIZED', 'caseId', v_case.id);
    update public.hr_attendance_mutation_operations
    set outcome = v_result, completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  elsif v_case.lifecycle_status in ('STALE', 'REJECTED') then
    v_result := jsonb_build_object('status', v_case.lifecycle_status, 'caseId', v_case.id);
    update public.hr_attendance_mutation_operations
    set outcome = v_result, completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  end if;

  select *
  into v_context
  from public.hr_resolve_attendance_fact_write_context(
    p_house_id, v_case.fact_id, v_entity_id
  );

  if not found then
    v_result := jsonb_build_object('status', 'TARGET_UNAVAILABLE');
    update public.hr_attendance_mutation_operations
    set outcome = v_result, completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  end if;

  if v_context.current_value_revision <> v_case.base_value_revision
    or v_context.evidence_basis_revision <> v_case.base_evidence_basis_revision
    or v_context.evidence_basis_fingerprint is distinct from v_case.base_evidence_basis_fingerprint then

    v_role := case
      when v_context.active_branch_id is not null then
        public.hr_attendance_actor_role_label(p_house_id, v_entity_id, v_context.active_branch_id)
      else public.hr_attendance_p1_broad_role_label(p_house_id, v_entity_id)
    end;

    if v_role is null then
      v_role := 'UNKNOWN';
    end if;

    insert into public.hr_attendance_correction_events (
      house_id, correction_case_id, employee_id,
      event_class, actor_entity_id, actor_role, details
    )
    values (
      p_house_id, v_case.id, v_case.employee_id,
      'STALE', v_entity_id, v_role,
      jsonb_build_object('reason', 'BASE_CHANGED')
    )
    on conflict do nothing;

    update public.hr_attendance_correction_cases
    set lifecycle_status = 'STALE'
    where house_id = p_house_id and id = v_case.id;

    v_result := jsonb_build_object('status', 'STALE', 'caseId', v_case.id);
    update public.hr_attendance_mutation_operations
    set outcome = v_result,
        fact_id = v_case.fact_id,
        value_revision = v_context.current_value_revision,
        evidence_basis_revision = v_context.evidence_basis_revision,
        completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
      and operation_id = btrim(p_operation_id);

    return v_result;
  end if;

  v_proposed_work_date := (v_case.proposed_snapshot ->> 'workDate')::date;
  v_proposed_time_in := (v_case.proposed_snapshot ->> 'timeIn')::timestamptz;
  v_proposed_time_out := nullif(v_case.proposed_snapshot ->> 'timeOut', '')::timestamptz;
  v_target_branch_id := nullif(v_case.proposed_snapshot ->> 'targetBranchId', '')::uuid;

  -- Recompute the correction shape and payroll-impact class from the immutable
  -- proposal/base at finalization. Never trust even the stored derived label as an
  -- authorization shortcut.
  v_recomputed_value_changed :=
    v_context.work_date is distinct from v_proposed_work_date
    or v_context.time_in is distinct from v_proposed_time_in
    or v_context.time_out is distinct from v_proposed_time_out;

  v_recomputed_location_changed :=
    v_target_branch_id is not null
    and v_target_branch_id is distinct from v_context.active_branch_id;

  v_recomputed_kind := case
    when v_recomputed_value_changed and v_recomputed_location_changed then 'COMBINED'
    when v_recomputed_location_changed then 'LOCATION'
    when v_recomputed_value_changed then 'VALUE_TIME'
    else null
  end;

  v_recomputed_payroll_impact := case
    when v_recomputed_value_changed then 'PAYROLL_IMPACTING'
    else 'NON_PAYROLL_IMPACTING'
  end;

  if v_recomputed_kind is null
    or v_case.correction_kind is distinct from v_recomputed_kind
    or v_case.payroll_impact is distinct from v_recomputed_payroll_impact then
    raise exception 'P1 correction classification no longer matches immutable proposal'
      using errcode = '55000';
  end if;

  if v_case.correction_kind in ('LOCATION', 'COMBINED') then
    if not public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id) then
      return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
    end if;
    if v_target_branch_id is null
      or not public.hr_attendance_actor_can_write_branch(
        p_house_id, v_entity_id, v_target_branch_id
      ) then
      return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
    end if;
    v_role := public.hr_attendance_actor_role_label(
      p_house_id, v_entity_id, v_target_branch_id
    );
  else
    v_role := case
      when v_context.active_branch_id is not null then
        public.hr_attendance_actor_role_label(p_house_id, v_entity_id, v_context.active_branch_id)
      else public.hr_attendance_p1_broad_role_label(p_house_id, v_entity_id)
    end;
  end if;

  if v_role is null then
    return jsonb_build_object('status', 'TARGET_UNAVAILABLE');
  end if;

  if v_recomputed_payroll_impact = 'PAYROLL_IMPACTING' then
    v_hr4 := public.hr_attendance_p1_hr4_decision(
      p_house_id, 'CORRECTION', v_case.id,
      md5(v_case.base_snapshot::text || '|' || v_case.proposed_snapshot::text)
    );
    v_hr4_status := upper(coalesce(v_hr4 ->> 'status', 'UNAVAILABLE'));

    if v_hr4_status = 'REJECTED' then
      insert into public.hr_attendance_correction_events (
        house_id, correction_case_id, employee_id,
        event_class, actor_entity_id, actor_role,
        decision_reference, details
      )
      values (
        p_house_id, v_case.id, v_case.employee_id,
        'REJECTED', v_entity_id, v_role,
        nullif(v_hr4 ->> 'decisionReference', ''),
        jsonb_build_object('status', v_hr4_status)
      );

      update public.hr_attendance_correction_cases
      set lifecycle_status = 'REJECTED',
          hr4_decision_reference = nullif(v_hr4 ->> 'decisionReference', '')
      where house_id = p_house_id and id = v_case.id;

      v_result := jsonb_build_object(
        'status', 'REJECTED',
        'caseId', v_case.id
      );

      update public.hr_attendance_mutation_operations
      set outcome = v_result,
          fact_id = v_case.fact_id,
          value_revision = v_case.base_value_revision,
          evidence_basis_revision = v_case.base_evidence_basis_revision,
          completed_at = now()
      where house_id = p_house_id
        and producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
        and operation_id = btrim(p_operation_id);

      return v_result;
    elsif v_hr4_status <> 'APPROVED' then
      v_result := jsonb_build_object(
        'status', 'APPROVAL_DEPENDENCY_UNAVAILABLE',
        'caseId', v_case.id
      );
      update public.hr_attendance_mutation_operations
      set outcome = v_result,
          fact_id = v_case.fact_id,
          value_revision = v_case.base_value_revision,
          evidence_basis_revision = v_case.base_evidence_basis_revision,
          completed_at = now()
      where house_id = p_house_id
        and producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
        and operation_id = btrim(p_operation_id);
      return v_result;
    end if;

    insert into public.hr_attendance_correction_events (
      house_id, correction_case_id, employee_id,
      event_class, actor_entity_id, actor_role,
      decision_reference, details
    )
    values (
      p_house_id, v_case.id, v_case.employee_id,
      'HR4_DECISION_OBSERVED', v_entity_id, v_role,
      nullif(v_hr4 ->> 'decisionReference', ''),
      jsonb_build_object('status', v_hr4_status)
    );

    update public.hr_attendance_correction_cases
    set hr4_decision_reference = nullif(v_hr4 ->> 'decisionReference', '')
    where house_id = p_house_id and id = v_case.id;
  end if;

  v_result := public.hr_apply_attendance_p1_finalization(
    p_house_id => p_house_id,
    p_employee_id => v_case.employee_id,
    p_mode => 'CORRECTION',
    p_case_id => v_case.id,
    p_fact_id => v_case.fact_id,
    p_work_date => v_proposed_work_date,
    p_time_in => v_proposed_time_in,
    p_time_out => v_proposed_time_out,
    p_target_branch_id => v_target_branch_id,
    p_actor_entity_id => v_entity_id,
    p_actor_role => v_role,
    p_base_value_revision => v_case.base_value_revision,
    p_base_evidence_basis_revision => v_case.base_evidence_basis_revision,
    p_base_evidence_basis_fingerprint => v_case.base_evidence_basis_fingerprint
  );

  insert into public.hr_attendance_correction_events (
    house_id, correction_case_id, employee_id,
    event_class, actor_entity_id, actor_role,
    result_value_revision, result_evidence_basis_revision, details
  )
  values (
    p_house_id, v_case.id, v_case.employee_id,
    'FINALIZED', v_entity_id, v_role,
    nullif(v_result ->> 'valueRevision', '')::bigint,
    nullif(v_result ->> 'evidenceBasisRevision', '')::bigint,
    jsonb_build_object('factId', v_case.fact_id)
  );

  update public.hr_attendance_correction_cases
  set lifecycle_status = 'FINALIZED'
  where house_id = p_house_id and id = v_case.id;

  update public.hr_attendance_mutation_operations
  set outcome = v_result || jsonb_build_object('caseId', v_case.id),
      fact_id = v_case.fact_id,
      value_revision = nullif(v_result ->> 'valueRevision', '')::bigint,
      evidence_basis_revision = nullif(v_result ->> 'evidenceBasisRevision', '')::bigint,
      completed_at = now()
  where house_id = p_house_id
    and producer_namespace = 'P1_CORRECTION_FINALIZE_V1'
    and operation_id = btrim(p_operation_id);

  return v_result || jsonb_build_object('caseId', v_case.id);
end
$function$;

-- OD-P1-01 Option A+: the ordinary create command itself is current Manila business
-- date only for every caller. Historical missing facts use DEC-018 remediation.
create or replace function public.hr_create_manual_attendance(
  p_house_id uuid,
  p_employee_id uuid,
  p_actual_branch_id uuid,
  p_operation_id text,
  p_work_date date,
  p_time_in timestamptz,
  p_time_out timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_employee_branch_id uuid;
  v_actor_role text;
  v_fingerprint text;
  v_manila_today date;
begin
  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_manila_today := (transaction_timestamp() at time zone 'Asia/Manila')::date;
  if p_work_date is distinct from v_manila_today then
    raise exception 'Historical manual creation requires owner/manager remediation review'
      using errcode = '42501';
  end if;

  if p_time_in is null
    or (p_time_in at time zone 'Asia/Manila')::date is distinct from p_work_date
    or (
      p_time_out is not null
      and (
        p_time_out <= p_time_in
        or (p_time_out at time zone 'Asia/Manila')::date not in (
          p_work_date, p_work_date + 1
        )
      )
    ) then
    raise exception 'Invalid current-day manual attendance timestamps'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || p_employee_id::text,
      0
    )
  );

  if not public.hr_attendance_actor_can_write_branch(
    p_house_id, v_entity_id, p_actual_branch_id
  ) then
    raise exception 'Manual attendance branch is outside caller authority'
      using errcode = '42501';
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
        p_house_id, v_entity_id, v_employee_branch_id
      ) then
      raise exception 'Attendance employee target is outside caller write scope'
        using errcode = '42501';
    end if;
  end if;

  v_actor_role := public.hr_attendance_actor_role_label(
    p_house_id, v_entity_id, p_actual_branch_id
  );
  if v_actor_role is null then
    raise exception 'Manual attendance actor role could not be resolved'
      using errcode = '42501';
  end if;

  v_fingerprint := md5(jsonb_build_array(
    'MANUAL_CREATE', p_house_id, p_employee_id, p_actual_branch_id,
    p_work_date, p_time_in, p_time_out
  )::text);

  return public.hr_apply_attendance_producer_mutation(
    p_house_id => p_house_id,
    p_employee_id => p_employee_id,
    p_producer_namespace => 'MANUAL_ADMIN_V1',
    p_operation_id => p_operation_id,
    p_request_fingerprint => v_fingerprint,
    p_mutation_kind => 'MANUAL_CREATE',
    p_work_date => p_work_date,
    p_time_in => p_time_in,
    p_time_out => p_time_out,
    p_actual_branch_id => p_actual_branch_id,
    p_actor_entity_id => v_entity_id,
    p_actor_role => v_actor_role
  );
end
$function$;

revoke all on function public.hr_attendance_p1_broad_role_label(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_apply_attendance_p1_finalization(
  uuid, uuid, text, uuid, uuid, date, timestamptz, timestamptz,
  uuid, uuid, text, bigint, bigint, text
) from public, anon, authenticated, service_role;

revoke all on function public.hr_propose_attendance_correction(
  uuid, uuid, text, date, timestamptz, timestamptz, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.hr_propose_attendance_correction(
  uuid, uuid, text, date, timestamptz, timestamptz, uuid, text
) to authenticated;

revoke all on function public.hr_finalize_attendance_correction(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.hr_finalize_attendance_correction(uuid, uuid, text)
  to authenticated;

-- The immediate-update RPC becomes non-public in the same migration that exposes
-- correction proposal/finalization, eliminating the semantic bypass.
revoke all on function public.hr_update_manual_attendance(
  uuid, uuid, text, timestamptz, timestamptz, bigint
) from public, anon, authenticated, service_role;

-- Preserve ordinary same-day create for authenticated HR writers under Option A+.
revoke all on function public.hr_create_manual_attendance(
  uuid, uuid, uuid, text, date, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.hr_create_manual_attendance(
  uuid, uuid, uuid, text, date, timestamptz, timestamptz
) to authenticated;

comment on function public.hr_propose_attendance_correction(
  uuid, uuid, text, date, timestamptz, timestamptz, uuid, text
) is
  'P1 immutable correction proposal command; hidden/unauthorized facts collapse to TARGET_UNAVAILABLE and active attendance is not mutated.';
comment on function public.hr_finalize_attendance_correction(uuid, uuid, text) is
  'P1 correction finalizer with shared Gate-B serialization, independent stale bases, fail-closed HR-4 seam, immutable lineage, and atomic canonical activation.';

notify pgrst, 'reload schema';
commit;
