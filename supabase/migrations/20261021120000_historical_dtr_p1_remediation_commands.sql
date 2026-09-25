-- Historical Daily DTR Write P1 owner/manager DEC-018 remediation commands.
begin;

create or replace function public.hr_open_attendance_remediation_case(
  p_house_id uuid,
  p_employee_id uuid,
  p_operation_id text,
  p_work_date date,
  p_time_in timestamptz,
  p_time_out timestamptz,
  p_asserted_branch_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_role text;
  v_resolver jsonb;
  v_generation bigint;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_case_id uuid;
  v_result jsonb;
  v_snapshot jsonb;
begin
  if p_house_id is null or p_employee_id is null
    or p_operation_id is null or length(btrim(p_operation_id)) = 0
    or p_work_date is null or p_time_in is null
    or (p_time_out is not null and p_time_out <= p_time_in)
    or p_asserted_branch_id is null
    or p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Invalid P1 remediation case' using errcode = '22023';
  end if;

  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id) then
    raise exception 'Historical missing-fact remediation requires House-wide authority'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.employees e
    where e.house_id = p_house_id and e.id = p_employee_id
  ) or not exists (
    select 1 from public.branches b
    where b.house_id = p_house_id and b.id = p_asserted_branch_id
  ) or not public.hr_attendance_actor_can_write_branch(
    p_house_id, v_entity_id, p_asserted_branch_id
  ) then
    raise exception 'Remediation target is unavailable' using errcode = '42501';
  end if;

  v_role := public.hr_attendance_actor_role_label(
    p_house_id, v_entity_id, p_asserted_branch_id
  );
  if v_role is null then
    raise exception 'Remediation actor role could not be resolved' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || p_employee_id::text,
      0
    )
  );

  v_resolver := public.hr_resolve_attendance_remediation_candidates(
    p_house_id, p_employee_id
  );
  v_generation := coalesce(
    nullif(v_resolver ->> 'candidateEvidenceGeneration', '')::bigint, 0
  );

  v_snapshot := jsonb_build_object(
    'workDate', p_work_date,
    'timeIn', p_time_in,
    'timeOut', p_time_out,
    'assertedBranchId', p_asserted_branch_id
  );

  v_fingerprint := md5(jsonb_build_array(
    'P1_REMEDIATION_OPEN_V1',
    p_house_id, p_employee_id, p_work_date, p_time_in, p_time_out,
    p_asserted_branch_id, btrim(p_reason),
    v_resolver ->> 'resolverVersion',
    v_resolver ->> 'digest',
    v_generation
  )::text);

  insert into public.hr_attendance_mutation_operations (
    house_id, producer_namespace, operation_id, employee_id, request_fingerprint
  )
  values (
    p_house_id, 'P1_REMEDIATION_OPEN_V1', btrim(p_operation_id),
    p_employee_id, v_fingerprint
  )
  on conflict (house_id, producer_namespace, operation_id) do nothing;

  select op.request_fingerprint, op.outcome
  into v_existing_fingerprint, v_existing_outcome
  from public.hr_attendance_mutation_operations op
  where op.house_id = p_house_id
    and op.producer_namespace = 'P1_REMEDIATION_OPEN_V1'
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

  insert into public.hr_attendance_remediation_cases (
    id, house_id, employee_id,
    proposed_snapshot, asserted_branch_id, reason,
    creator_entity_id, creator_role,
    base_candidate_evidence_generation,
    resolver_version, resolver_digest,
    coverage_complete, resolver_snapshot
  )
  values (
    v_case_id, p_house_id, p_employee_id,
    v_snapshot, p_asserted_branch_id, btrim(p_reason),
    v_entity_id, v_role,
    v_generation,
    coalesce(v_resolver ->> 'resolverVersion', 'P1_DEC018_V1'),
    coalesce(v_resolver ->> 'digest', md5('[]')),
    coalesce((v_resolver ->> 'coverageComplete')::boolean, false),
    coalesce(v_resolver -> 'candidates', '[]'::jsonb)
  );

  v_result := jsonb_build_object(
    'status', 'OPEN',
    'caseId', v_case_id,
    'resolverVersion', v_resolver ->> 'resolverVersion',
    'resolverDigest', v_resolver ->> 'digest',
    'candidateEvidenceGeneration', v_generation,
    'coverageComplete', coalesce((v_resolver ->> 'coverageComplete')::boolean, false),
    'candidates', coalesce(v_resolver -> 'candidates', '[]'::jsonb),
    'replayed', false
  );

  update public.hr_attendance_mutation_operations
  set outcome = v_result,
      completed_at = now()
  where house_id = p_house_id
    and producer_namespace = 'P1_REMEDIATION_OPEN_V1'
    and operation_id = btrim(p_operation_id);

  return v_result;
end
$function$;

create or replace function public.hr_adjudicate_attendance_remediation_case(
  p_house_id uuid,
  p_remediation_case_id uuid,
  p_operation_id text,
  p_decision text,
  p_selected_candidate_identity text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_case public.hr_attendance_remediation_cases%rowtype;
  v_resolver jsonb;
  v_generation bigint;
  v_role text;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_selected jsonb;
  v_result jsonb;
  v_event_class text;
begin
  if p_house_id is null or p_remediation_case_id is null
    or p_operation_id is null or length(btrim(p_operation_id)) = 0
    or p_decision not in ('EXISTING_RELATED', 'DISTINCT_NEW')
    or (
      p_decision = 'EXISTING_RELATED'
      and (p_selected_candidate_identity is null
        or length(btrim(p_selected_candidate_identity)) = 0)
    )
    or (
      p_decision = 'DISTINCT_NEW'
      and p_selected_candidate_identity is not null
      and length(btrim(p_selected_candidate_identity)) > 0
    ) then
    raise exception 'Invalid P1 remediation adjudication' using errcode = '22023';
  end if;

  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id) then
    raise exception 'Historical missing-fact remediation requires House-wide authority'
      using errcode = '42501';
  end if;

  select c.*
  into v_case
  from public.hr_attendance_remediation_cases c
  where c.house_id = p_house_id and c.id = p_remediation_case_id;

  if not found then
    raise exception 'Remediation case is unavailable' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || v_case.employee_id::text,
      0
    )
  );

  v_fingerprint := md5(jsonb_build_array(
    'P1_REMEDIATION_ADJUDICATE_V1',
    p_house_id, p_remediation_case_id, p_decision,
    nullif(btrim(coalesce(p_selected_candidate_identity, '')), '')
  )::text);

  insert into public.hr_attendance_mutation_operations (
    house_id, producer_namespace, operation_id, employee_id, request_fingerprint
  )
  values (
    p_house_id, 'P1_REMEDIATION_ADJUDICATE_V1', btrim(p_operation_id),
    v_case.employee_id, v_fingerprint
  )
  on conflict (house_id, producer_namespace, operation_id) do nothing;

  select op.request_fingerprint, op.outcome
  into v_existing_fingerprint, v_existing_outcome
  from public.hr_attendance_mutation_operations op
  where op.house_id = p_house_id
    and op.producer_namespace = 'P1_REMEDIATION_ADJUDICATE_V1'
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
  from public.hr_attendance_remediation_cases c
  where c.house_id = p_house_id and c.id = p_remediation_case_id
  for update;

  if v_case.lifecycle_status = 'FINALIZED' then
    v_result := jsonb_build_object('status', 'ALREADY_FINALIZED', 'caseId', v_case.id);
    update public.hr_attendance_mutation_operations
    set outcome = v_result, completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_REMEDIATION_ADJUDICATE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  end if;

  v_resolver := public.hr_resolve_attendance_remediation_candidates(
    p_house_id, v_case.employee_id
  );
  v_generation := coalesce(
    nullif(v_resolver ->> 'candidateEvidenceGeneration', '')::bigint, 0
  );

  if p_decision = 'DISTINCT_NEW'
    and not coalesce((v_resolver ->> 'coverageComplete')::boolean, false) then
    v_result := jsonb_build_object(
      'status', 'COVERAGE_INCOMPLETE',
      'caseId', v_case.id
    );
    update public.hr_attendance_mutation_operations
    set outcome = v_result, completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_REMEDIATION_ADJUDICATE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  end if;

  if p_decision = 'EXISTING_RELATED' then
    select candidate.value
    into v_selected
    from jsonb_array_elements(coalesce(v_resolver -> 'candidates', '[]'::jsonb)) candidate(value)
    where candidate.value ->> 'identity' = btrim(p_selected_candidate_identity)
    limit 1;

    if v_selected is null then
      raise exception 'Selected remediation candidate is not in the current resolver universe'
        using errcode = '22023';
    end if;

    v_event_class := 'ADJUDICATED_EXISTING';
  else
    v_event_class := 'ADJUDICATED_DISTINCT';
  end if;

  v_role := public.hr_attendance_actor_role_label(
    p_house_id, v_entity_id, v_case.asserted_branch_id
  );
  if v_role is null then
    raise exception 'Remediation actor role could not be resolved' using errcode = '42501';
  end if;

  insert into public.hr_attendance_remediation_events (
    house_id, remediation_case_id, employee_id,
    event_class, actor_entity_id, actor_role,
    selected_candidate_identity,
    resolver_version, resolver_digest,
    candidate_evidence_generation, details
  )
  values (
    p_house_id, v_case.id, v_case.employee_id,
    v_event_class, v_entity_id, v_role,
    case when p_decision = 'EXISTING_RELATED'
      then btrim(p_selected_candidate_identity) else null end,
    v_resolver ->> 'resolverVersion',
    v_resolver ->> 'digest',
    v_generation,
    jsonb_build_object(
      'coverageComplete', coalesce((v_resolver ->> 'coverageComplete')::boolean, false),
      'selectedCandidate', v_selected
    )
  );

  -- A fresh adjudication after STALE becomes the current finalizable base without
  -- rewriting any earlier event.
  if v_case.lifecycle_status = 'STALE' then
    update public.hr_attendance_remediation_cases
    set lifecycle_status = 'OPEN'
    where house_id = p_house_id and id = v_case.id;
  end if;

  if p_decision = 'EXISTING_RELATED' then
    insert into public.hr_attendance_remediation_events (
      house_id, remediation_case_id, employee_id,
      event_class, actor_entity_id, actor_role,
      selected_candidate_identity,
      resolver_version, resolver_digest,
      candidate_evidence_generation, details
    )
    values (
      p_house_id, v_case.id, v_case.employee_id,
      'FINALIZED', v_entity_id, v_role,
      btrim(p_selected_candidate_identity),
      v_resolver ->> 'resolverVersion',
      v_resolver ->> 'digest',
      v_generation,
      jsonb_build_object(
        'route', case
          when v_selected ->> 'kind' = 'FACT' then 'CORRECTION'
          else 'UNRESOLVED_REVIEW'
        end,
        'selectedCandidate', v_selected
      )
    );

    update public.hr_attendance_remediation_cases
    set lifecycle_status = 'FINALIZED'
    where house_id = p_house_id and id = v_case.id;

    v_result := jsonb_build_object(
      'status', 'EXISTING_RELATED',
      'caseId', v_case.id,
      'selectedCandidate', v_selected,
      'route', case
        when v_selected ->> 'kind' = 'FACT' then 'CORRECTION'
        else 'UNRESOLVED_REVIEW'
      end
    );
  else
    v_result := jsonb_build_object(
      'status', 'ADJUDICATED_DISTINCT',
      'caseId', v_case.id,
      'resolverVersion', v_resolver ->> 'resolverVersion',
      'resolverDigest', v_resolver ->> 'digest',
      'candidateEvidenceGeneration', v_generation
    );
  end if;

  update public.hr_attendance_mutation_operations
  set outcome = v_result,
      completed_at = now()
  where house_id = p_house_id
    and producer_namespace = 'P1_REMEDIATION_ADJUDICATE_V1'
    and operation_id = btrim(p_operation_id);

  return v_result;
end
$function$;

create or replace function public.hr_finalize_attendance_remediation_case(
  p_house_id uuid,
  p_remediation_case_id uuid,
  p_operation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_id uuid;
  v_case public.hr_attendance_remediation_cases%rowtype;
  v_adjudication public.hr_attendance_remediation_events%rowtype;
  v_resolver jsonb;
  v_generation bigint;
  v_role text;
  v_hr4 jsonb;
  v_hr4_status text;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_result jsonb;
  v_work_date date;
  v_time_in timestamptz;
  v_time_out timestamptz;
begin
  if p_house_id is null or p_remediation_case_id is null
    or p_operation_id is null or length(btrim(p_operation_id)) = 0 then
    raise exception 'Invalid P1 remediation finalization' using errcode = '22023';
  end if;

  v_entity_id := public.current_entity_id();
  if v_entity_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.hr_attendance_actor_has_broad_write(p_house_id, v_entity_id) then
    raise exception 'Historical missing-fact remediation requires House-wide authority'
      using errcode = '42501';
  end if;

  select c.*
  into v_case
  from public.hr_attendance_remediation_cases c
  where c.house_id = p_house_id and c.id = p_remediation_case_id;

  if not found then
    raise exception 'Remediation case is unavailable' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'gap024.attendance_mutation:' || p_house_id::text || ':' || v_case.employee_id::text,
      0
    )
  );

  v_fingerprint := md5(jsonb_build_array(
    'P1_REMEDIATION_FINALIZE_V1', p_house_id, p_remediation_case_id
  )::text);

  insert into public.hr_attendance_mutation_operations (
    house_id, producer_namespace, operation_id, employee_id, request_fingerprint
  )
  values (
    p_house_id, 'P1_REMEDIATION_FINALIZE_V1', btrim(p_operation_id),
    v_case.employee_id, v_fingerprint
  )
  on conflict (house_id, producer_namespace, operation_id) do nothing;

  select op.request_fingerprint, op.outcome
  into v_existing_fingerprint, v_existing_outcome
  from public.hr_attendance_mutation_operations op
  where op.house_id = p_house_id
    and op.producer_namespace = 'P1_REMEDIATION_FINALIZE_V1'
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
  from public.hr_attendance_remediation_cases c
  where c.house_id = p_house_id and c.id = p_remediation_case_id
  for update;

  if v_case.lifecycle_status = 'FINALIZED' then
    v_result := jsonb_build_object(
      'status', 'ALREADY_FINALIZED',
      'caseId', v_case.id,
      'factId', v_case.resulting_fact_id
    );
    update public.hr_attendance_mutation_operations
    set outcome = v_result,
        fact_id = v_case.resulting_fact_id,
        completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_REMEDIATION_FINALIZE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  end if;

  select e.*
  into v_adjudication
  from public.hr_attendance_remediation_events e
  where e.house_id = p_house_id
    and e.remediation_case_id = v_case.id
    and e.event_class in ('ADJUDICATED_EXISTING', 'ADJUDICATED_DISTINCT')
  order by e.event_at desc, e.id desc
  limit 1
  for update;

  if not found or v_adjudication.event_class <> 'ADJUDICATED_DISTINCT' then
    raise exception 'Distinct-new remediation requires an explicit current adjudication'
      using errcode = '22023';
  end if;

  v_resolver := public.hr_resolve_attendance_remediation_candidates(
    p_house_id, v_case.employee_id
  );
  v_generation := coalesce(
    nullif(v_resolver ->> 'candidateEvidenceGeneration', '')::bigint, 0
  );

  v_role := public.hr_attendance_actor_role_label(
    p_house_id, v_entity_id, v_case.asserted_branch_id
  );
  if v_role is null then
    raise exception 'Remediation actor role could not be resolved' using errcode = '42501';
  end if;

  if not coalesce((v_resolver ->> 'coverageComplete')::boolean, false)
    or v_resolver ->> 'resolverVersion' is distinct from v_adjudication.resolver_version
    or v_resolver ->> 'digest' is distinct from v_adjudication.resolver_digest
    or v_generation is distinct from v_adjudication.candidate_evidence_generation then

    insert into public.hr_attendance_remediation_events (
      house_id, remediation_case_id, employee_id,
      event_class, actor_entity_id, actor_role,
      resolver_version, resolver_digest,
      candidate_evidence_generation, details
    )
    values (
      p_house_id, v_case.id, v_case.employee_id,
      'STALE', v_entity_id, v_role,
      v_resolver ->> 'resolverVersion',
      v_resolver ->> 'digest',
      v_generation,
      jsonb_build_object('reason', 'CANDIDATE_UNIVERSE_CHANGED')
    );

    update public.hr_attendance_remediation_cases
    set lifecycle_status = 'STALE'
    where house_id = p_house_id and id = v_case.id;

    v_result := jsonb_build_object('status', 'STALE', 'caseId', v_case.id);
    update public.hr_attendance_mutation_operations
    set outcome = v_result, completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_REMEDIATION_FINALIZE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  end if;

  -- DISTINCT_NEW is always payroll-impacting under the frozen classifier.
  v_hr4 := public.hr_attendance_p1_hr4_decision(
    p_house_id, 'REMEDIATION', v_case.id,
    md5(v_case.proposed_snapshot::text || '|' || v_case.resolver_digest)
  );
  v_hr4_status := upper(coalesce(v_hr4 ->> 'status', 'UNAVAILABLE'));

  if v_hr4_status <> 'APPROVED' then
    v_result := jsonb_build_object(
      'status', 'APPROVAL_DEPENDENCY_UNAVAILABLE',
      'caseId', v_case.id
    );
    update public.hr_attendance_mutation_operations
    set outcome = v_result, completed_at = now()
    where house_id = p_house_id
      and producer_namespace = 'P1_REMEDIATION_FINALIZE_V1'
      and operation_id = btrim(p_operation_id);
    return v_result;
  end if;

  if not public.hr_attendance_actor_can_write_branch(
    p_house_id, v_entity_id, v_case.asserted_branch_id
  ) then
    raise exception 'Remediation branch authority changed' using errcode = '42501';
  end if;

  v_work_date := (v_case.proposed_snapshot ->> 'workDate')::date;
  v_time_in := (v_case.proposed_snapshot ->> 'timeIn')::timestamptz;
  v_time_out := nullif(v_case.proposed_snapshot ->> 'timeOut', '')::timestamptz;

  v_result := public.hr_apply_attendance_p1_finalization(
    p_house_id => p_house_id,
    p_employee_id => v_case.employee_id,
    p_mode => 'REMEDIATION_CREATE',
    p_case_id => v_case.id,
    p_fact_id => null,
    p_work_date => v_work_date,
    p_time_in => v_time_in,
    p_time_out => v_time_out,
    p_target_branch_id => v_case.asserted_branch_id,
    p_actor_entity_id => v_entity_id,
    p_actor_role => v_role,
    p_base_value_revision => null,
    p_base_evidence_basis_revision => null,
    p_base_evidence_basis_fingerprint => null
  );

  insert into public.hr_attendance_remediation_events (
    house_id, remediation_case_id, employee_id,
    event_class, actor_entity_id, actor_role,
    resolver_version, resolver_digest,
    candidate_evidence_generation, resulting_fact_id, details
  )
  values (
    p_house_id, v_case.id, v_case.employee_id,
    'FINALIZED', v_entity_id, v_role,
    v_adjudication.resolver_version,
    v_adjudication.resolver_digest,
    v_adjudication.candidate_evidence_generation,
    nullif(v_result ->> 'factId', '')::uuid,
    jsonb_build_object(
      'hr4DecisionReference', nullif(v_hr4 ->> 'decisionReference', '')
    )
  );

  update public.hr_attendance_remediation_cases
  set lifecycle_status = 'FINALIZED',
      resulting_fact_id = nullif(v_result ->> 'factId', '')::uuid
  where house_id = p_house_id and id = v_case.id;

  update public.hr_attendance_mutation_operations
  set outcome = v_result || jsonb_build_object('caseId', v_case.id),
      fact_id = nullif(v_result ->> 'factId', '')::uuid,
      value_revision = nullif(v_result ->> 'valueRevision', '')::bigint,
      evidence_basis_revision = nullif(v_result ->> 'evidenceBasisRevision', '')::bigint,
      completed_at = now()
  where house_id = p_house_id
    and producer_namespace = 'P1_REMEDIATION_FINALIZE_V1'
    and operation_id = btrim(p_operation_id);

  return v_result || jsonb_build_object('caseId', v_case.id);
end
$function$;

revoke all on function public.hr_open_attendance_remediation_case(
  uuid, uuid, text, date, timestamptz, timestamptz, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.hr_open_attendance_remediation_case(
  uuid, uuid, text, date, timestamptz, timestamptz, uuid, text
) to authenticated;

revoke all on function public.hr_adjudicate_attendance_remediation_case(
  uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.hr_adjudicate_attendance_remediation_case(
  uuid, uuid, text, text, text
) to authenticated;

revoke all on function public.hr_finalize_attendance_remediation_case(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.hr_finalize_attendance_remediation_case(
  uuid, uuid, text
) to authenticated;

comment on function public.hr_open_attendance_remediation_case(
  uuid, uuid, text, date, timestamptz, timestamptz, uuid, text
) is
  'P1 DEC-018 owner/manager case open: captures explicit branch/reason plus complete employee-wide candidate resolver base without creating attendance.';
comment on function public.hr_adjudicate_attendance_remediation_case(
  uuid, uuid, text, text, text
) is
  'P1 DEC-018 explicit adjudication: EXISTING_RELATED selects only a resolver-returned candidate; DISTINCT_NEW requires complete coverage.';
comment on function public.hr_finalize_attendance_remediation_case(uuid, uuid, text) is
  'P1 DEC-018 distinct-new finalizer: generation/digest revalidation, fail-closed HR-4 seam, durable case observation identity, and atomic canonical creation.';

notify pgrst, 'reload schema';
commit;
