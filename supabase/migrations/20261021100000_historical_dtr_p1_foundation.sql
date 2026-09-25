-- Historical Daily DTR Write P1 persistence + private resolution foundation.
-- Owner-approved planning authority: PR #513 / OD-P1-01 Option A+.
-- This migration is additive. Public mutation cutover is performed by the next P1 migrations.
begin;

create table public.hr_attendance_correction_cases (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null,
  fact_id uuid not null,
  correction_kind text not null
    check (correction_kind in ('VALUE_TIME', 'LOCATION', 'COMBINED')),
  payroll_impact text not null
    check (payroll_impact in ('PAYROLL_IMPACTING', 'NON_PAYROLL_IMPACTING')),
  base_value_revision bigint not null check (base_value_revision > 0),
  base_evidence_basis_revision bigint not null check (base_evidence_basis_revision > 0),
  base_evidence_basis_fingerprint text not null
    check (length(btrim(base_evidence_basis_fingerprint)) > 0),
  base_candidate_evidence_generation bigint,
  base_snapshot jsonb not null,
  proposed_snapshot jsonb not null,
  reason text not null check (length(btrim(reason)) >= 3),
  proposer_entity_id uuid not null references public.entities(id) on delete restrict,
  proposer_role text not null check (length(btrim(proposer_role)) > 0),
  proposed_at timestamptz not null default now(),
  lifecycle_status text not null default 'OPEN'
    check (lifecycle_status in ('OPEN', 'STALE', 'REJECTED', 'FINALIZED')),
  hr4_decision_reference text,
  constraint hr_attendance_correction_cases_house_employee_fk
    foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict,
  constraint hr_attendance_correction_cases_fact_fk
    foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_correction_cases_house_id_employee_unique
    unique (house_id, id, employee_id)
);

create index hr_attendance_correction_cases_fact_idx
  on public.hr_attendance_correction_cases(house_id, fact_id, proposed_at desc);
create index hr_attendance_correction_cases_employee_idx
  on public.hr_attendance_correction_cases(house_id, employee_id, proposed_at desc);

create table public.hr_attendance_correction_events (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  correction_case_id uuid not null,
  employee_id uuid not null,
  event_class text not null
    check (event_class in ('HR4_DECISION_OBSERVED', 'REJECTED', 'STALE', 'FINALIZED')),
  actor_entity_id uuid not null references public.entities(id) on delete restrict,
  actor_role text not null check (length(btrim(actor_role)) > 0),
  event_at timestamptz not null default now(),
  result_value_revision bigint,
  result_evidence_basis_revision bigint,
  decision_reference text,
  details jsonb not null default '{}'::jsonb,
  constraint hr_attendance_correction_events_case_fk
    foreign key (house_id, correction_case_id, employee_id)
    references public.hr_attendance_correction_cases(house_id, id, employee_id)
    on delete restrict
);

create unique index hr_attendance_correction_terminal_unique_idx
  on public.hr_attendance_correction_events(house_id, correction_case_id)
  where event_class in ('STALE', 'REJECTED', 'FINALIZED');

create index hr_attendance_correction_events_case_idx
  on public.hr_attendance_correction_events(house_id, correction_case_id, event_at, id);

create table public.hr_attendance_remediation_cases (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null,
  proposed_snapshot jsonb not null,
  asserted_branch_id uuid not null,
  reason text not null check (length(btrim(reason)) >= 3),
  creator_entity_id uuid not null references public.entities(id) on delete restrict,
  creator_role text not null check (length(btrim(creator_role)) > 0),
  created_at timestamptz not null default now(),
  base_candidate_evidence_generation bigint not null check (base_candidate_evidence_generation >= 0),
  resolver_version text not null check (length(btrim(resolver_version)) > 0),
  resolver_digest text not null check (length(btrim(resolver_digest)) > 0),
  coverage_complete boolean not null,
  resolver_snapshot jsonb not null,
  lifecycle_status text not null default 'OPEN'
    check (lifecycle_status in ('OPEN', 'STALE', 'FINALIZED')),
  resulting_fact_id uuid,
  constraint hr_attendance_remediation_cases_house_employee_fk
    foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict,
  constraint hr_attendance_remediation_cases_branch_fk
    foreign key (house_id, asserted_branch_id)
    references public.branches(house_id, id) on delete restrict,
  constraint hr_attendance_remediation_cases_result_fact_fk
    foreign key (house_id, resulting_fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_remediation_cases_house_id_employee_unique
    unique (house_id, id, employee_id)
);

create index hr_attendance_remediation_cases_employee_idx
  on public.hr_attendance_remediation_cases(house_id, employee_id, created_at desc);

create table public.hr_attendance_remediation_events (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  remediation_case_id uuid not null,
  employee_id uuid not null,
  event_class text not null
    check (event_class in ('ADJUDICATED_EXISTING', 'ADJUDICATED_DISTINCT', 'STALE', 'FINALIZED')),
  actor_entity_id uuid not null references public.entities(id) on delete restrict,
  actor_role text not null check (length(btrim(actor_role)) > 0),
  event_at timestamptz not null default now(),
  selected_candidate_identity text,
  resolver_version text,
  resolver_digest text,
  candidate_evidence_generation bigint,
  resulting_fact_id uuid,
  details jsonb not null default '{}'::jsonb,
  constraint hr_attendance_remediation_events_case_fk
    foreign key (house_id, remediation_case_id, employee_id)
    references public.hr_attendance_remediation_cases(house_id, id, employee_id)
    on delete restrict,
  constraint hr_attendance_remediation_events_result_fact_fk
    foreign key (house_id, resulting_fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete restrict
);

create unique index hr_attendance_remediation_finalized_unique_idx
  on public.hr_attendance_remediation_events(house_id, remediation_case_id)
  where event_class = 'FINALIZED';

create index hr_attendance_remediation_events_case_idx
  on public.hr_attendance_remediation_events(house_id, remediation_case_id, event_at, id);

alter table public.hr_attendance_correction_cases enable row level security;
alter table public.hr_attendance_correction_events enable row level security;
alter table public.hr_attendance_remediation_cases enable row level security;
alter table public.hr_attendance_remediation_events enable row level security;

revoke all on public.hr_attendance_correction_cases
  from public, anon, authenticated, service_role;
revoke all on public.hr_attendance_correction_events
  from public, anon, authenticated, service_role;
revoke all on public.hr_attendance_remediation_cases
  from public, anon, authenticated, service_role;
revoke all on public.hr_attendance_remediation_events
  from public, anon, authenticated, service_role;

-- Private scope-first capability guard. It proves the actor has at least one
-- attendance write scope in the requested House before any protected fact/case is
-- dereferenced. This prevents exact-ID timing/state from becoming the first authorization
-- probe.
create or replace function public.hr_attendance_actor_has_any_write_scope(
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
      public.hr_attendance_actor_has_broad_write(p_house_id, p_entity_id)
      or exists (
        select 1
        from public.branches b
        where b.house_id = p_house_id
          and public.hr_attendance_actor_can_write_branch(
            p_house_id, p_entity_id, b.id
          )
      )
    )
$function$;

-- P1 exact-fact resolver deliberately calls the already-protected canonical readers.
-- This keeps write-target visibility no broader than the read authority already approved
-- in Gate A. It is private and returns nothing for guessed/hidden targets.
create or replace function public.hr_resolve_attendance_fact_write_context(
  p_house_id uuid,
  p_fact_id uuid,
  p_actor_entity_id uuid
)
returns table(
  fact_id uuid,
  employee_id uuid,
  work_date date,
  time_in timestamptz,
  time_out timestamptz,
  hours_worked numeric,
  overtime_minutes integer,
  status text,
  attribution_state text,
  active_branch_id uuid,
  current_value_revision bigint,
  evidence_basis_revision bigint,
  evidence_basis_fingerprint text,
  is_broad_actor boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_fact public.hr_attendance_facts%rowtype;
  v_revision public.hr_attendance_fact_revisions%rowtype;
  v_projection public.hr_attendance_authorization_projection%rowtype;
  v_broad boolean;
  v_visible boolean := false;
  v_offset integer := 0;
  v_page_count integer;
begin
  if p_house_id is null or p_fact_id is null or p_actor_entity_id is null
    or public.current_entity_id() is distinct from p_actor_entity_id
    or not public.hr_attendance_actor_has_any_write_scope(
      p_house_id, p_actor_entity_id
    ) then
    return;
  end if;

  select f.*
  into v_fact
  from public.hr_attendance_facts f
  where f.house_id = p_house_id
    and f.id = p_fact_id
    and f.is_active;

  if not found then
    return;
  end if;

  select r.*
  into v_revision
  from public.hr_attendance_fact_revisions r
  where r.house_id = v_fact.house_id
    and r.fact_id = v_fact.id
    and r.employee_id = v_fact.employee_id
    and r.revision = v_fact.current_value_revision;

  if not found then
    return;
  end if;

  select p.*
  into v_projection
  from public.hr_attendance_authorization_projection p
  where p.house_id = v_fact.house_id
    and p.fact_id = v_fact.id
    and p.employee_id = v_fact.employee_id
    and p.value_revision = v_fact.current_value_revision
    and p.evidence_basis_revision = v_fact.evidence_basis_revision;

  if not found then
    return;
  end if;

  v_broad := public.hr_attendance_actor_has_broad_write(p_house_id, p_actor_entity_id);

  if v_broad then
    loop
      select exists (
        select 1
        from public.hr_read_canonical_attendance_house_global(
          p_house_id, v_revision.work_date, v_revision.work_date,
          v_fact.employee_id, 200, v_offset
        ) visible
        where visible.fact_id = p_fact_id
      ), count(*)
      into v_visible, v_page_count
      from public.hr_read_canonical_attendance_house_global(
        p_house_id, v_revision.work_date, v_revision.work_date,
        v_fact.employee_id, 200, v_offset
      );

      exit when v_visible or v_page_count < 200;
      v_offset := v_offset + 200;
    end loop;
  else
    loop
      select exists (
        select 1
        from public.hr_read_canonical_attendance_branch_scoped(
          p_house_id, v_revision.work_date, v_revision.work_date,
          v_fact.employee_id, 200, v_offset
        ) visible
        where visible.fact_id = p_fact_id
      ), count(*)
      into v_visible, v_page_count
      from public.hr_read_canonical_attendance_branch_scoped(
        p_house_id, v_revision.work_date, v_revision.work_date,
        v_fact.employee_id, 200, v_offset
      );

      exit when v_visible or v_page_count < 200;
      v_offset := v_offset + 200;
    end loop;

    if v_visible and (
      v_projection.attribution_state is distinct from 'ATTRIBUTED'
      or v_projection.active_branch_id is null
      or not public.hr_attendance_actor_can_write_branch(
        p_house_id, p_actor_entity_id, v_projection.active_branch_id
      )
    ) then
      v_visible := false;
    end if;
  end if;

  if not v_visible then
    return;
  end if;

  return query
  select
    v_fact.id,
    v_fact.employee_id,
    v_revision.work_date,
    v_revision.time_in,
    v_revision.time_out,
    v_revision.hours_worked,
    v_revision.overtime_minutes,
    v_revision.status,
    v_projection.attribution_state,
    v_projection.active_branch_id,
    v_fact.current_value_revision,
    v_fact.evidence_basis_revision,
    v_projection.evidence_basis_fingerprint,
    v_broad;
end
$function$;

-- Default HR-4 seam is intentionally fail-closed. Disposable DB tests may replace this
-- private function to model a future approved provider, but no application role can call it.
create or replace function public.hr_attendance_p1_hr4_decision(
  p_house_id uuid,
  p_case_kind text,
  p_case_id uuid,
  p_proposal_fingerprint text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object('status', 'UNAVAILABLE')
$function$;

-- Complete employee-wide resolver for DEC-018. Date windows may focus display later,
-- but they never define authority completeness.
create or replace function public.hr_resolve_attendance_remediation_candidates(
  p_house_id uuid,
  p_employee_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_candidates jsonb;
  v_generation bigint;
  v_coverage_complete boolean;
  v_digest text;
begin
  if p_house_id is null or p_employee_id is null
    or not exists (
      select 1 from public.employees e
      where e.house_id = p_house_id and e.id = p_employee_id
    ) then
    return jsonb_build_object(
      'resolverVersion', 'P1_DEC018_V1',
      'coverageComplete', false,
      'candidateEvidenceGeneration', 0,
      'digest', md5('[]'),
      'candidates', '[]'::jsonb
    );
  end if;

  select coalesce(g.candidate_evidence_generation, 0)
  into v_generation
  from (select 1) seed
  left join public.hr_attendance_employee_generations g
    on g.house_id = p_house_id and g.employee_id = p_employee_id;

  with current_evidence as (
    select ev.*
    from public.hr_attendance_evidence ev
    where ev.house_id = p_house_id
      and ev.employee_id = p_employee_id
      and not exists (
        select 1
        from public.hr_attendance_evidence successor
        where successor.house_id = ev.house_id
          and successor.employee_id = ev.employee_id
          and successor.lineage_root_evidence_id = ev.lineage_root_evidence_id
          and successor.supersedes_evidence_id = ev.id
      )
  ), fact_candidates as (
    select
      'FACT:' || f.id::text as identity,
      jsonb_build_object(
        'identity', 'FACT:' || f.id::text,
        'kind', 'FACT',
        'factId', f.id,
        'isActive', f.is_active,
        'workDate', r.work_date,
        'timeIn', r.time_in,
        'timeOut', r.time_out,
        'attributionState', p.attribution_state,
        'activeBranchId', p.active_branch_id
      ) as payload
    from public.hr_attendance_facts f
    join public.hr_attendance_fact_revisions r
      on r.house_id = f.house_id
      and r.fact_id = f.id
      and r.employee_id = f.employee_id
      and r.revision = f.current_value_revision
    left join public.hr_attendance_authorization_projection p
      on p.house_id = f.house_id
      and p.fact_id = f.id
      and p.employee_id = f.employee_id
    where f.house_id = p_house_id
      and f.employee_id = p_employee_id
  ), evidence_candidates as (
    select
      'EVIDENCE:' || ev.id::text as identity,
      jsonb_build_object(
        'identity', 'EVIDENCE:' || ev.id::text,
        'kind', 'EVIDENCE',
        'evidenceId', ev.id,
        'observationId', ev.observation_id,
        'integrityState', ev.integrity_state,
        'branchId', ev.branch_id,
        'lineageRootEvidenceId', ev.lineage_root_evidence_id,
        'occurredAt', obs.occurred_at
      ) as payload
    from current_evidence ev
    left join public.hr_attendance_observations obs
      on obs.house_id = ev.house_id
      and obs.id = ev.observation_id
      and obs.employee_id = ev.employee_id
    where ev.integrity_state in ('ESTABLISHED', 'UNRESOLVED')
  ), observation_candidates as (
    select
      'OBSERVATION:' || obs.id::text as identity,
      jsonb_build_object(
        'identity', 'OBSERVATION:' || obs.id::text,
        'kind', 'OBSERVATION',
        'observationId', obs.id,
        'sourceNamespace', obs.source_namespace,
        'sourceObservationId', obs.source_observation_id,
        'occurredAt', obs.occurred_at
      ) as payload
    from public.hr_attendance_observations obs
    where obs.house_id = p_house_id
      and obs.employee_id = p_employee_id
      and not exists (
        select 1 from current_evidence ev
        where ev.observation_id = obs.id
      )
  ), all_candidates as (
    select identity, payload from fact_candidates
    union all
    select identity, payload from evidence_candidates
    union all
    select identity, payload from observation_candidates
  )
  select coalesce(jsonb_agg(payload order by identity), '[]'::jsonb)
  into v_candidates
  from all_candidates;

  with current_evidence as (
    select ev.*
    from public.hr_attendance_evidence ev
    where ev.house_id = p_house_id
      and ev.employee_id = p_employee_id
      and not exists (
        select 1
        from public.hr_attendance_evidence successor
        where successor.house_id = ev.house_id
          and successor.employee_id = ev.employee_id
          and successor.lineage_root_evidence_id = ev.lineage_root_evidence_id
          and successor.supersedes_evidence_id = ev.id
      )
  )
  select not (
    exists (
      select 1 from current_evidence ev
      where ev.integrity_state not in ('ESTABLISHED', 'UNRESOLVED', 'INVALID')
    )
    or exists (
      select 1
      from current_evidence ev
      group by ev.lineage_root_evidence_id
      having count(*) > 1
    )
  )
  into v_coverage_complete;

  v_digest := md5(v_candidates::text);

  return jsonb_build_object(
    'resolverVersion', 'P1_DEC018_V1',
    'coverageComplete', v_coverage_complete,
    'candidateEvidenceGeneration', v_generation,
    'digest', v_digest,
    'candidates', v_candidates
  );
end
$function$;

create index if not exists hr_attendance_facts_house_employee_idx
  on public.hr_attendance_facts(house_id, employee_id, id);
create index if not exists hr_attendance_fact_revisions_house_employee_work_idx
  on public.hr_attendance_fact_revisions(house_id, employee_id, work_date, fact_id, revision);
create index if not exists hr_attendance_evidence_house_employee_lineage_idx
  on public.hr_attendance_evidence(house_id, employee_id, lineage_root_evidence_id, id);
create index if not exists hr_attendance_observations_house_employee_idx
  on public.hr_attendance_observations(house_id, employee_id, occurred_at, id);

revoke all on function public.hr_attendance_actor_has_any_write_scope(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_resolve_attendance_fact_write_context(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_attendance_p1_hr4_decision(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.hr_resolve_attendance_remediation_candidates(uuid, uuid)
  from public, anon, authenticated, service_role;

comment on table public.hr_attendance_correction_cases is
  'P1 immutable historical attendance correction proposal authority; active attendance changes only through guarded finalization.';
comment on table public.hr_attendance_remediation_cases is
  'P1 DEC-018 owner/manager historical missing-fact remediation identity and resolver base.';
comment on function public.hr_attendance_actor_has_any_write_scope(uuid, uuid) is
  'Private P1 scope-first guard: verifies some House attendance write capability before protected target dereference.';
comment on function public.hr_resolve_attendance_fact_write_context(uuid, uuid, uuid) is
  'Private P1 exact-fact write resolver whose visibility is no broader than Gate-A protected canonical readers.';
comment on function public.hr_resolve_attendance_remediation_candidates(uuid, uuid) is
  'Private P1 DEC-018 employee-wide candidate/evidence resolver; date windows never define completeness.';

notify pgrst, 'reload schema';
commit;
