-- GAP-024 Gate B authenticated manual producer commands.
-- Requires the additive containment foundation migration.
begin;

create or replace function public.hr_attendance_actor_has_broad_write(
  p_house_id uuid,
  p_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    p_house_id is not null
    and p_entity_id is not null
    and (
      public.current_entity_is_gm()
      or exists (
        select 1
        from public.house_roles hr
        where hr.house_id = p_house_id
          and hr.entity_id = p_entity_id
          and lower(btrim(hr.role)) in (
            'house_owner', 'business_owner',
            'house_manager', 'business_admin', 'business_manager'
          )
      )
    )
$function$;

create or replace function public.hr_attendance_actor_role_label(
  p_house_id uuid,
  p_entity_id uuid,
  p_branch_id uuid
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
  if p_house_id is null or p_entity_id is null or p_branch_id is null then
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
    and (
      lower(btrim(hr.role)) in (
        'house_owner', 'business_owner',
        'house_manager', 'business_admin', 'business_manager'
      )
      or (
        hr.role_id is not null
        and exists (
          select 1
          from public.role_policies rp
          join public.policies p on p.id = rp.policy_id
          where rp.role_id = hr.role_id
            and p.key = 'domain.hr.all'
        )
        and exists (
          select 1
          from public.role_policies rp
          join public.policies p on p.id = rp.policy_id
          where rp.role_id = hr.role_id
            and p.key in (
              'hr.branch.' || p_branch_id::text,
              'tiles.hr.branch.' || p_branch_id::text,
              'hr:branch:' || p_branch_id::text,
              'tiles:hr:branch:' || p_branch_id::text
            )
        )
      )
    )
  order by
    case
      when lower(btrim(hr.role)) in ('house_owner', 'business_owner') then 1
      when lower(btrim(hr.role)) in ('house_manager', 'business_admin', 'business_manager') then 2
      else 3
    end,
    hr.role
  limit 1;

  return v_role;
end
$function$;

-- Preserve all Gate-A evidence-lineage rules while widening the manual provenance
-- authority check to the already-approved Gate-B branch-scoped HR writer contract.
create or replace function public.hr_guard_attendance_evidence_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_predecessor_observation_id uuid;
  v_predecessor_lineage_root_id uuid;
  v_predecessor_lane text;
  v_predecessor_evidence_kind text;
  v_predecessor_branch_id uuid;
  v_observation_lineage_root_id uuid;
  v_observation_has_evidence boolean := false;
  v_expected_actor_role text;
begin
  if new.observation_id is not null then
    perform 1
    from public.hr_attendance_observations observation
    where observation.house_id = new.house_id
      and observation.id = new.observation_id
      and observation.employee_id = new.employee_id
    for update;
    if not found then
      raise exception 'Observation-backed evidence requires matching House and employee ownership'
        using errcode = '23503';
    end if;

    select existing.lineage_root_evidence_id
    into v_observation_lineage_root_id
    from public.hr_attendance_evidence existing
    where existing.house_id = new.house_id
      and existing.observation_id = new.observation_id
      and existing.employee_id = new.employee_id
    order by existing.recorded_at, existing.id
    limit 1;
    v_observation_has_evidence := found;

    if v_observation_has_evidence and exists (
      select 1
      from public.hr_attendance_evidence inconsistent
      where inconsistent.house_id = new.house_id
        and inconsistent.observation_id = new.observation_id
        and inconsistent.employee_id = new.employee_id
        and inconsistent.lineage_root_evidence_id <> v_observation_lineage_root_id
    ) then
      raise exception 'A canonical observation may own only one semantic evidence lineage'
        using errcode = '23514';
    end if;

    if v_observation_has_evidence and new.supersedes_evidence_id is null then
      raise exception 'Later observation evidence must explicitly supersede its same-observation predecessor'
        using errcode = '23514';
    end if;
  end if;

  if new.supersedes_evidence_id is not null then
    select predecessor.observation_id, predecessor.lineage_root_evidence_id,
      predecessor.lane, predecessor.evidence_kind, predecessor.branch_id
    into v_predecessor_observation_id, v_predecessor_lineage_root_id,
      v_predecessor_lane, v_predecessor_evidence_kind, v_predecessor_branch_id
    from public.hr_attendance_evidence predecessor
    where predecessor.house_id = new.house_id
      and predecessor.id = new.supersedes_evidence_id
      and predecessor.employee_id = new.employee_id
    for update;
    if not found then
      raise exception 'Semantic evidence supersession requires a matching predecessor'
        using errcode = '23514';
    end if;
    if v_predecessor_observation_id is distinct from new.observation_id then
      raise exception 'Semantic evidence supersession must preserve stable observation identity'
        using errcode = '23514';
    end if;
    if v_predecessor_observation_id is not null
      and (v_predecessor_lane = 'KIOSK' or new.lane = 'KIOSK')
      and (
        new.lane is distinct from v_predecessor_lane
        or new.evidence_kind is distinct from v_predecessor_evidence_kind
        or new.branch_id is distinct from v_predecessor_branch_id
      ) then
      raise exception 'Kiosk evidence successors must preserve observation lane, logical role, and branch'
        using errcode = '23514';
    end if;
    if new.lineage_root_evidence_id is null then
      new.lineage_root_evidence_id := v_predecessor_lineage_root_id;
    elsif new.lineage_root_evidence_id <> v_predecessor_lineage_root_id then
      raise exception 'Semantic evidence successor cannot select another lineage root'
        using errcode = '23514';
    end if;
    if v_observation_has_evidence
      and new.lineage_root_evidence_id <> v_observation_lineage_root_id then
      raise exception 'Observation evidence must inherit its established lineage root'
        using errcode = '23514';
    end if;
  else
    if new.lineage_root_evidence_id is null then
      new.lineage_root_evidence_id := new.id;
    elsif new.lineage_root_evidence_id <> new.id then
      raise exception 'Root evidence must identify itself as its lineage root'
        using errcode = '23514';
    end if;
  end if;

  if new.lane = 'MANUAL_ADMIN'
    and new.evidence_kind = 'EXPLICIT_BRANCH'
    and new.integrity_state = 'ESTABLISHED'
    and new.is_integrity_eligible then
    if new.branch_id is null
      or new.authorization_namespace is null
      or length(btrim(new.authorization_namespace)) = 0
      or new.authorization_reference is null
      or length(btrim(new.authorization_reference)) = 0
      or new.asserted_at is null
      or new.asserted_by_entity_id is null
      or new.asserted_by_house_role is null then
      raise exception 'Manual attendance provenance is incomplete'
        using errcode = '23514';
    end if;

    if not public.hr_attendance_actor_can_write_branch(
      new.house_id,
      new.asserted_by_entity_id,
      new.branch_id
    ) then
      raise exception 'Manual attendance provenance requires exact-House branch authority'
        using errcode = '23514';
    end if;

    v_expected_actor_role := public.hr_attendance_actor_role_label(
      new.house_id,
      new.asserted_by_entity_id,
      new.branch_id
    );

    if v_expected_actor_role is null
      or lower(btrim(v_expected_actor_role)) <> lower(btrim(new.asserted_by_house_role)) then
      raise exception 'Manual attendance provenance actor role does not match current authority'
        using errcode = '23514';
    end if;
  end if;

  return new;
end
$function$;

create or replace function public.hr_attendance_bump_employee_generation(
  p_house_id uuid,
  p_employee_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_generation bigint;
begin
  insert into public.hr_attendance_employee_generations (
    house_id,
    employee_id,
    candidate_evidence_generation,
    updated_at
  )
  values (p_house_id, p_employee_id, 1, now())
  on conflict (house_id, employee_id) do update
  set candidate_evidence_generation =
        public.hr_attendance_employee_generations.candidate_evidence_generation + 1,
      updated_at = now()
  returning candidate_evidence_generation into v_generation;

  return v_generation;
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
    or p_mutation_kind not in ('MANUAL_CREATE', 'MANUAL_UPDATE') then
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
    return v_existing_outcome;
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
  v_actor_role text;
  v_fingerprint text;
begin
  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.hr_attendance_actor_can_write_branch(
    p_house_id,
    v_entity_id,
    p_actual_branch_id
  ) then
    raise exception 'Manual attendance branch is outside caller authority'
      using errcode = '42501';
  end if;

  v_actor_role := public.hr_attendance_actor_role_label(
    p_house_id,
    v_entity_id,
    p_actual_branch_id
  );
  if v_actor_role is null then
    raise exception 'Manual attendance actor role could not be resolved'
      using errcode = '42501';
  end if;

  v_fingerprint := md5(jsonb_build_array(
    'MANUAL_CREATE',
    p_house_id,
    p_employee_id,
    p_actual_branch_id,
    p_work_date,
    p_time_in,
    p_time_out
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

create or replace function public.hr_update_manual_attendance(
  p_house_id uuid,
  p_segment_id uuid,
  p_operation_id text,
  p_time_in timestamptz,
  p_time_out timestamptz default null,
  p_expected_value_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_employee_id uuid;
  v_fact_id uuid;
  v_active_branch_id uuid;
  v_attribution_state text;
  v_fingerprint text;
begin
  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select segment.employee_id, segment.canonical_fact_id
  into v_employee_id, v_fact_id
  from public.dtr_segments segment
  where segment.house_id = p_house_id
    and segment.id = p_segment_id;
  if not found then
    raise exception 'Attendance segment was not found'
      using errcode = 'P0002';
  end if;

  if not public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id) then
    if v_fact_id is null then
      raise exception 'Unattributed legacy attendance requires House-wide write authority'
        using errcode = '42501';
    end if;

    select projection.attribution_state, projection.active_branch_id
    into v_attribution_state, v_active_branch_id
    from public.hr_attendance_authorization_projection projection
    where projection.house_id = p_house_id
      and projection.fact_id = v_fact_id
      and projection.employee_id = v_employee_id;

    if v_attribution_state is distinct from 'ATTRIBUTED'
      or v_active_branch_id is null
      or not public.hr_attendance_actor_can_write_branch(
        p_house_id,
        v_entity_id,
        v_active_branch_id
      ) then
      raise exception 'Attendance fact is outside caller write scope'
        using errcode = '42501';
    end if;
  end if;

  v_fingerprint := md5(jsonb_build_array(
    'MANUAL_UPDATE',
    p_house_id,
    p_segment_id,
    p_time_in,
    p_time_out,
    p_expected_value_revision
  )::text);

  return public.hr_apply_attendance_producer_mutation(
    p_house_id => p_house_id,
    p_employee_id => v_employee_id,
    p_producer_namespace => 'MANUAL_ADMIN_V1',
    p_operation_id => p_operation_id,
    p_request_fingerprint => v_fingerprint,
    p_mutation_kind => 'MANUAL_UPDATE',
    p_segment_id => p_segment_id,
    p_time_in => p_time_in,
    p_time_out => p_time_out,
    p_expected_value_revision => p_expected_value_revision
  );
end
$function$;

create or replace function public.hr_get_dtr_mutation_tokens(
  p_house_id uuid,
  p_segment_ids uuid[]
)
returns table (
  segment_id uuid,
  canonical_fact_id uuid,
  current_value_revision bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
begin
  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_house_id is null
    or p_segment_ids is null
    or cardinality(p_segment_ids) > 500 then
    raise exception 'Invalid attendance mutation token request'
      using errcode = '22023';
  end if;

  return query
  select
    segment.id,
    segment.canonical_fact_id,
    fact.current_value_revision
  from public.dtr_segments segment
  left join public.hr_attendance_facts fact
    on fact.house_id = segment.house_id
    and fact.id = segment.canonical_fact_id
    and fact.employee_id = segment.employee_id
    and fact.is_active
  left join public.hr_attendance_authorization_projection projection
    on projection.house_id = fact.house_id
    and projection.fact_id = fact.id
    and projection.employee_id = fact.employee_id
  where segment.house_id = p_house_id
    and segment.id = any(p_segment_ids)
    and (
      public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id)
      or (
        segment.canonical_fact_id is not null
        and projection.attribution_state = 'ATTRIBUTED'
        and projection.active_branch_id is not null
        and public.hr_attendance_actor_can_write_branch(
          p_house_id,
          v_entity_id,
          projection.active_branch_id
        )
      )
    );
end
$function$;

revoke all on function public.hr_attendance_actor_has_broad_write(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_attendance_actor_role_label(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_attendance_bump_employee_generation(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_apply_attendance_producer_mutation(
  uuid, uuid, text, text, text, text, uuid, date, timestamptz, timestamptz,
  uuid, uuid, text, bigint
) from public, anon, authenticated, service_role;

revoke all on function public.hr_create_manual_attendance(
  uuid, uuid, uuid, text, date, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.hr_create_manual_attendance(
  uuid, uuid, uuid, text, date, timestamptz, timestamptz
) to authenticated;

revoke all on function public.hr_update_manual_attendance(
  uuid, uuid, text, timestamptz, timestamptz, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.hr_update_manual_attendance(
  uuid, uuid, text, timestamptz, timestamptz, bigint
) to authenticated;

revoke all on function public.hr_get_dtr_mutation_tokens(uuid, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.hr_get_dtr_mutation_tokens(uuid, uuid[])
  to authenticated;

comment on function public.hr_apply_attendance_producer_mutation(
  uuid, uuid, text, text, text, text, uuid, date, timestamptz, timestamptz,
  uuid, uuid, text, bigint
) is
  'Private Gate-B mutation engine. Producer-specific wrappers own authorization and caller contracts.';

notify pgrst, 'reload schema';
commit;
