-- GAP-024 Gate A: canonical attendance authority, rebuildable authorization
-- projection, and protected consumption boundaries. This migration is additive and
-- intentionally performs no legacy backfill or producer/consumer cutover.
begin;

create unique index if not exists employees_house_id_id_unique_idx
  on public.employees (house_id, id);
create unique index if not exists dtr_segments_house_id_id_employee_id_unique_idx
  on public.dtr_segments (house_id, id, employee_id);

-- DEC-019 stable real-world observation identity. Semantic evidence revisions point
-- to this immutable authority; retries reuse its House + namespace + opaque identity.
create table public.hr_attendance_observations (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null,
  source_namespace text not null check (length(btrim(source_namespace)) > 0),
  source_observation_id text not null check (length(btrim(source_observation_id)) > 0),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint hr_attendance_observations_source_identity_unique
    unique (house_id, source_namespace, source_observation_id),
  constraint hr_attendance_observations_house_id_id_employee_unique
    unique (house_id, id, employee_id),
  constraint hr_attendance_observations_house_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict
);

create table public.hr_attendance_facts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null,
  is_active boolean not null default true,
  current_value_revision bigint not null default 1 check (current_value_revision > 0),
  evidence_basis_revision bigint not null default 1 check (evidence_basis_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_attendance_facts_house_id_id_unique unique (house_id, id),
  constraint hr_attendance_facts_house_id_id_employee_unique unique (house_id, id, employee_id),
  constraint hr_attendance_facts_house_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict
);

create table public.hr_attendance_fact_revisions (
  house_id uuid not null,
  fact_id uuid not null,
  employee_id uuid not null,
  revision bigint not null check (revision > 0),
  predecessor_revision bigint,
  dtr_segment_id uuid,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  hours_worked numeric,
  overtime_minutes integer not null default 0,
  source text not null,
  status text not null,
  recorded_at timestamptz not null default now(),
  primary key (house_id, fact_id, revision),
  constraint hr_attendance_fact_revisions_fact_fk foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete cascade,
  constraint hr_attendance_fact_revisions_predecessor_fk
    foreign key (house_id, fact_id, predecessor_revision)
    references public.hr_attendance_fact_revisions(house_id, fact_id, revision),
  constraint hr_attendance_fact_revisions_segment_fk foreign key (house_id, dtr_segment_id, employee_id)
    references public.dtr_segments(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_fact_revisions_predecessor_shape check (
    (revision = 1 and predecessor_revision is null)
    or (revision > 1 and predecessor_revision = revision - 1)
  )
);

alter table public.hr_attendance_facts
  add constraint hr_attendance_facts_current_revision_fk
  foreign key (house_id, id, current_value_revision)
  references public.hr_attendance_fact_revisions(house_id, fact_id, revision)
  deferrable initially deferred;

create table public.hr_attendance_evidence (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null,
  observation_id uuid,
  lane text not null check (lane in ('KIOSK', 'MANUAL_ADMIN', 'BULK_IMPORT')),
  evidence_kind text not null check (evidence_kind in ('LOGICAL_IN', 'LOGICAL_OUT', 'EXPLICIT_BRANCH')),
  branch_id uuid,
  integrity_state text not null default 'UNRESOLVED'
    check (integrity_state in ('ESTABLISHED', 'UNRESOLVED', 'INVALID')),
  sufficiency_state text not null default 'UNRESOLVED'
    check (sufficiency_state in ('SUFFICIENT', 'INSUFFICIENT', 'UNRESOLVED')),
  is_integrity_eligible boolean not null default true,
  semantic_revision bigint not null default 1 check (semantic_revision > 0),
  supersedes_evidence_id uuid,
  lineage_root_evidence_id uuid not null,
  asserted_by_entity_id uuid,
  asserted_by_house_role text,
  authorization_namespace text,
  authorization_reference text,
  asserted_at timestamptz,
  source_reference text,
  recorded_at timestamptz not null default now(),
  constraint hr_attendance_evidence_house_id_id_unique unique (house_id, id),
  constraint hr_attendance_evidence_house_id_id_employee_unique unique (house_id, id, employee_id),
  constraint hr_attendance_evidence_house_id_id_employee_revision_unique
    unique (house_id, id, employee_id, semantic_revision),
  constraint hr_attendance_evidence_house_id_id_employee_observation_unique
    unique (house_id, id, employee_id, observation_id),
  constraint hr_attendance_evidence_house_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict,
  constraint hr_attendance_evidence_house_branch_fk foreign key (house_id, branch_id)
    references public.branches(house_id, id) on delete restrict,
  constraint hr_attendance_evidence_observation_fk foreign key (house_id, observation_id, employee_id)
    references public.hr_attendance_observations(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_evidence_asserting_entity_fk foreign key (asserted_by_entity_id)
    references public.entities(id) on delete restrict,
  constraint hr_attendance_evidence_supersedes_fk foreign key (house_id, supersedes_evidence_id, employee_id)
    references public.hr_attendance_evidence(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_evidence_lineage_root_fk
    foreign key (house_id, lineage_root_evidence_id, employee_id)
    references public.hr_attendance_evidence(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_evidence_supersedes_observation_fk
    foreign key (house_id, supersedes_evidence_id, employee_id, observation_id)
    references public.hr_attendance_evidence(house_id, id, employee_id, observation_id) on delete restrict,
  constraint hr_attendance_evidence_kind_lane_check check (
    (lane = 'KIOSK' and evidence_kind in ('LOGICAL_IN', 'LOGICAL_OUT'))
    or (lane in ('MANUAL_ADMIN', 'BULK_IMPORT') and evidence_kind = 'EXPLICIT_BRANCH')
  ),
  constraint hr_attendance_evidence_established_branch_check check (
    integrity_state <> 'ESTABLISHED' or branch_id is not null
  ),
  constraint hr_attendance_evidence_sufficient_check check (
    sufficiency_state <> 'SUFFICIENT'
    or (integrity_state = 'ESTABLISHED' and is_integrity_eligible and branch_id is not null)
  ),
  constraint hr_attendance_evidence_kiosk_observation_authority_check check (
    lane <> 'KIOSK'
    or (integrity_state <> 'ESTABLISHED' and sufficiency_state <> 'SUFFICIENT')
    or observation_id is not null
  ),
  constraint hr_attendance_evidence_asserting_actor_shape check (
    (asserted_by_entity_id is null and asserted_by_house_role is null)
    or (asserted_by_entity_id is not null and asserted_by_house_role is not null)
  ),
  constraint hr_attendance_evidence_explicit_audit_check check (
    not (
      lane in ('MANUAL_ADMIN', 'BULK_IMPORT')
      and evidence_kind = 'EXPLICIT_BRANCH'
      and integrity_state = 'ESTABLISHED'
      and sufficiency_state = 'SUFFICIENT'
    ) or (
      authorization_namespace is not null and length(btrim(authorization_namespace)) > 0
      and authorization_reference is not null and length(btrim(authorization_reference)) > 0
      and asserted_at is not null
      and (lane <> 'MANUAL_ADMIN' or asserted_by_entity_id is not null)
    )
  ),
  constraint hr_attendance_evidence_no_self_supersession check (supersedes_evidence_id is distinct from id)
);

create unique index hr_attendance_evidence_observation_semantic_revision_unique_idx
  on public.hr_attendance_evidence (house_id, observation_id, semantic_revision)
  where observation_id is not null;

create table public.hr_attendance_evidence_frames (
  house_id uuid not null,
  fact_id uuid not null,
  employee_id uuid not null,
  evidence_basis_revision bigint not null check (evidence_basis_revision > 0),
  predecessor_revision bigint,
  semantic_completion_mode text not null
    check (semantic_completion_mode in ('OPEN', 'COMPLETED', 'UNRESOLVED')),
  is_sealed boolean not null default false,
  sealed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (house_id, fact_id, evidence_basis_revision),
  constraint hr_attendance_evidence_frames_house_fact_employee_unique
    unique (house_id, fact_id, employee_id, evidence_basis_revision),
  constraint hr_attendance_evidence_frames_fact_fk foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_evidence_frames_predecessor_fk
    foreign key (house_id, fact_id, predecessor_revision)
    references public.hr_attendance_evidence_frames(house_id, fact_id, evidence_basis_revision),
  constraint hr_attendance_evidence_frames_predecessor_shape check (
    (evidence_basis_revision = 1 and predecessor_revision is null)
    or (evidence_basis_revision > 1 and predecessor_revision = evidence_basis_revision - 1)
  ),
  constraint hr_attendance_evidence_frames_sealed_shape check (
    (is_sealed and sealed_at is not null) or (not is_sealed and sealed_at is null)
  )
);

create table public.hr_attendance_fact_evidence (
  house_id uuid not null,
  fact_id uuid not null,
  evidence_basis_revision bigint not null,
  evidence_id uuid not null,
  employee_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (house_id, fact_id, evidence_basis_revision, evidence_id),
  constraint hr_attendance_fact_evidence_frame_fk
    foreign key (house_id, fact_id, employee_id, evidence_basis_revision)
    references public.hr_attendance_evidence_frames(house_id, fact_id, employee_id, evidence_basis_revision)
    on delete restrict,
  constraint hr_attendance_fact_evidence_evidence_fk foreign key (house_id, evidence_id, employee_id)
    references public.hr_attendance_evidence(house_id, id, employee_id) on delete restrict
);

alter table public.hr_attendance_facts
  add constraint hr_attendance_facts_current_evidence_frame_fk
  foreign key (house_id, id, employee_id, evidence_basis_revision)
  references public.hr_attendance_evidence_frames(house_id, fact_id, employee_id, evidence_basis_revision)
  deferrable initially deferred;

-- Evidence semantics and every completed membership frame are append-only authority.
-- A semantic change creates a superseding evidence row and a new frame instead of
-- mutating the meaning seen by an older basis revision.
create or replace function public.hr_reject_attendance_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception 'Canonical attendance history is append-only'
    using errcode = '55000';
end
$function$;

create or replace function public.hr_guard_attendance_evidence_frame()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Canonical attendance evidence frames are immutable'
      using errcode = '55000';
  end if;
  if old.is_sealed or not new.is_sealed or new.sealed_at is null
    or new.house_id <> old.house_id or new.fact_id <> old.fact_id
    or new.employee_id <> old.employee_id
    or new.evidence_basis_revision <> old.evidence_basis_revision
    or new.predecessor_revision is distinct from old.predecessor_revision
    or new.semantic_completion_mode <> old.semantic_completion_mode
    or new.created_at <> old.created_at then
    raise exception 'Only one-way evidence frame sealing is permitted'
      using errcode = '55000';
  end if;
  return new;
end
$function$;

create or replace function public.hr_guard_attendance_evidence_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_predecessor_observation_id uuid;
  v_predecessor_lineage_root_id uuid;
begin
  if new.supersedes_evidence_id is not null then
    select predecessor.observation_id, predecessor.lineage_root_evidence_id
      into v_predecessor_observation_id, v_predecessor_lineage_root_id
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
    if new.lineage_root_evidence_id is null then
      new.lineage_root_evidence_id := v_predecessor_lineage_root_id;
    elsif new.lineage_root_evidence_id <> v_predecessor_lineage_root_id then
      raise exception 'Semantic evidence successor cannot select another lineage root'
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
    and new.sufficiency_state = 'SUFFICIENT' then
    perform 1 from public.house_roles hr
      where hr.house_id = new.house_id
        and hr.entity_id = new.asserted_by_entity_id
        and hr.role = new.asserted_by_house_role
      for key share;
    if not found then
      raise exception 'Manual attendance provenance requires exact-House actor authority'
        using errcode = '23514';
    end if;
  end if;
  return new;
end
$function$;

create or replace function public.hr_guard_attendance_frame_membership_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_observation_id uuid;
  v_lineage_root_evidence_id uuid;
begin
  -- The canonical evidence row is the stable serialization target for the first
  -- evidence-to-fact association. Concurrent attempts for different facts cannot
  -- both pass: the waiter rechecks immutable membership history after acquiring
  -- this row lock.
  select e.observation_id, e.lineage_root_evidence_id
    into v_observation_id, v_lineage_root_evidence_id
  from public.hr_attendance_evidence e
    where e.house_id = new.house_id and e.id = new.evidence_id
      and e.employee_id = new.employee_id
    for update;
  if not found then
    raise exception 'Evidence membership requires matching House and employee ownership'
      using errcode = '23503';
  end if;

  -- Every supersession-family member shares and locks this immutable root before
  -- membership history is checked, including explicit evidence with no observation.
  perform 1 from public.hr_attendance_evidence lineage_root
    where lineage_root.house_id = new.house_id
      and lineage_root.id = v_lineage_root_evidence_id
      and lineage_root.employee_id = new.employee_id
      and lineage_root.lineage_root_evidence_id = lineage_root.id
    for update;
  if not found then
    raise exception 'Evidence membership requires a valid immutable lineage root'
      using errcode = '23514';
  end if;

  -- Observation-backed semantic successors serialize on the stable observation as
  -- well, ensuring the whole real-world observation chain binds to one fact.
  if v_observation_id is not null then
    perform 1 from public.hr_attendance_observations o
      where o.house_id = new.house_id and o.id = v_observation_id
        and o.employee_id = new.employee_id
      for update;
  end if;

  if exists (
    select 1
    from public.hr_attendance_fact_evidence existing
    join public.hr_attendance_evidence historical_evidence
      on historical_evidence.house_id = existing.house_id
      and historical_evidence.id = existing.evidence_id
    where existing.house_id = new.house_id
      and (
        existing.evidence_id = new.evidence_id
        or historical_evidence.lineage_root_evidence_id = v_lineage_root_evidence_id
        or (v_observation_id is not null and historical_evidence.observation_id = v_observation_id)
      )
      and existing.fact_id <> new.fact_id
  ) then
    raise exception 'Canonical evidence is already bound to another attendance fact'
      using errcode = '23514';
  end if;

  perform 1 from public.hr_attendance_evidence_frames ef
    where ef.house_id = new.house_id and ef.fact_id = new.fact_id
      and ef.employee_id = new.employee_id
      and ef.evidence_basis_revision = new.evidence_basis_revision
      and not ef.is_sealed
    for update;
  if not found then
    raise exception 'Evidence membership requires an unsealed matching frame'
      using errcode = '55000';
  end if;
  return new;
end
$function$;

create or replace function public.hr_guard_attendance_fact_revision_segment_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.dtr_segment_id is null then
    return new;
  end if;

  -- The physical segment is the serialization target for concurrent first bindings.
  perform 1 from public.dtr_segments s
    where s.house_id = new.house_id and s.id = new.dtr_segment_id
      and s.employee_id = new.employee_id
    for update;
  if not found then
    raise exception 'Segment lineage requires matching House and employee ownership'
      using errcode = '23503';
  end if;

  if exists (
    select 1 from public.hr_attendance_fact_revisions existing
    where existing.house_id = new.house_id
      and existing.dtr_segment_id = new.dtr_segment_id
      and existing.fact_id <> new.fact_id
  ) then
    raise exception 'Physical attendance segment is already bound to another fact'
      using errcode = '23514';
  end if;
  return new;
end
$function$;

create trigger hr_attendance_observations_immutable
before update or delete on public.hr_attendance_observations
for each row execute function public.hr_reject_attendance_history_mutation();
create trigger hr_attendance_evidence_immutable
before update or delete on public.hr_attendance_evidence
for each row execute function public.hr_reject_attendance_history_mutation();
create trigger hr_attendance_evidence_insert_guard
before insert on public.hr_attendance_evidence
for each row execute function public.hr_guard_attendance_evidence_insert();
create trigger hr_attendance_fact_revisions_immutable
before update or delete on public.hr_attendance_fact_revisions
for each row execute function public.hr_reject_attendance_history_mutation();
create trigger hr_attendance_fact_revision_segment_insert_guard
before insert on public.hr_attendance_fact_revisions
for each row execute function public.hr_guard_attendance_fact_revision_segment_insert();
create trigger hr_attendance_evidence_frames_immutable
before update or delete on public.hr_attendance_evidence_frames
for each row execute function public.hr_guard_attendance_evidence_frame();
create trigger hr_attendance_fact_evidence_insert_guard
before insert on public.hr_attendance_fact_evidence
for each row execute function public.hr_guard_attendance_frame_membership_insert();
create trigger hr_attendance_fact_evidence_immutable
before update or delete on public.hr_attendance_fact_evidence
for each row execute function public.hr_reject_attendance_history_mutation();

-- Distinct DEC-018 concurrency domain. Gate A stores the generation separately
-- from fact/value and evidence-basis revisions; Gate B owns atomic producer use.
create table public.hr_attendance_employee_generations (
  house_id uuid not null,
  employee_id uuid not null,
  candidate_evidence_generation bigint not null default 1
    check (candidate_evidence_generation > 0),
  updated_at timestamptz not null default now(),
  primary key (house_id, employee_id),
  constraint hr_attendance_employee_generations_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete cascade
);

create table public.hr_attendance_authorization_projection (
  house_id uuid not null,
  fact_id uuid not null,
  employee_id uuid not null,
  value_revision bigint not null,
  evidence_basis_revision bigint not null,
  evidence_basis_fingerprint text not null,
  attribution_state text not null check (attribution_state in ('ATTRIBUTED', 'UNATTRIBUTED', 'CONFLICT')),
  active_branch_id uuid,
  governing_evidence_ids uuid[] not null default '{}'::uuid[],
  rebuilt_at timestamptz not null default now(),
  primary key (house_id, fact_id),
  constraint hr_attendance_projection_fact_fk foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete cascade,
  constraint hr_attendance_projection_house_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict,
  constraint hr_attendance_projection_house_branch_fk foreign key (house_id, active_branch_id)
    references public.branches(house_id, id) on delete restrict,
  constraint hr_attendance_projection_state_branch_check check (
    (attribution_state = 'ATTRIBUTED' and active_branch_id is not null)
    or (attribution_state in ('UNATTRIBUTED', 'CONFLICT') and active_branch_id is null)
  )
);

create index hr_attendance_facts_house_employee_idx
  on public.hr_attendance_facts (house_id, employee_id);
create index hr_attendance_fact_revisions_segment_idx
  on public.hr_attendance_fact_revisions (house_id, dtr_segment_id)
  where dtr_segment_id is not null;
create index hr_attendance_fact_revisions_house_work_date_idx
  on public.hr_attendance_fact_revisions (house_id, work_date, time_in, fact_id, revision);
create index hr_attendance_evidence_unresolved_idx
  on public.hr_attendance_evidence (house_id, employee_id, recorded_at)
  where is_integrity_eligible and integrity_state = 'UNRESOLVED';
create index hr_attendance_fact_evidence_frame_idx
  on public.hr_attendance_fact_evidence (house_id, fact_id, evidence_basis_revision);
create index hr_attendance_projection_branch_idx
  on public.hr_attendance_authorization_projection (house_id, active_branch_id, fact_id)
  where attribution_state = 'ATTRIBUTED';

-- Canonical classifier/rebuilder. Evidence rows are already canonical logical
-- observations; this function does not infer duplicate/replay identity from kiosk JSON.
create or replace function public.hr_rebuild_attendance_authorization_projection(p_house_id uuid)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_count bigint;
begin
  if p_house_id is null or not exists (select 1 from public.houses h where h.id = p_house_id) then
    raise exception 'Invalid attendance projection scope' using errcode = '22023';
  end if;

  delete from public.hr_attendance_authorization_projection p
  where p.house_id = p_house_id;

  with evidence_frame as (
    select
      f.house_id,
      f.id as fact_id,
      f.employee_id,
      f.current_value_revision,
      f.evidence_basis_revision,
      ef.semantic_completion_mode,
      e.id as evidence_id,
      e.lane,
      e.evidence_kind,
      e.branch_id,
      e.integrity_state,
      e.sufficiency_state,
      e.is_integrity_eligible,
      e.semantic_revision,
      o.source_namespace,
      o.source_observation_id,
      o.occurred_at,
      e.asserted_by_entity_id,
      e.asserted_by_house_role,
      e.authorization_namespace,
      e.authorization_reference,
      e.asserted_at
    from public.hr_attendance_facts f
    join public.hr_attendance_evidence_frames ef
      on ef.house_id = f.house_id and ef.fact_id = f.id
      and ef.employee_id = f.employee_id
      and ef.evidence_basis_revision = f.evidence_basis_revision
      and ef.is_sealed
    left join public.hr_attendance_fact_evidence a
      on a.house_id = ef.house_id and a.fact_id = ef.fact_id
      and a.employee_id = ef.employee_id
      and a.evidence_basis_revision = ef.evidence_basis_revision
    left join public.hr_attendance_evidence e
      on e.house_id = a.house_id and e.id = a.evidence_id
    left join public.hr_attendance_observations o
      on o.house_id = e.house_id and o.id = e.observation_id
      and o.employee_id = e.employee_id
    where f.house_id = p_house_id and f.is_active
  ), aggregate_frame as (
    select
      house_id,
      fact_id,
      employee_id,
      current_value_revision,
      evidence_basis_revision,
      semantic_completion_mode,
      count(distinct branch_id) filter (
        where integrity_state = 'ESTABLISHED' and is_integrity_eligible and branch_id is not null
      ) as established_branch_count,
      (array_agg(distinct branch_id order by branch_id) filter (
        where integrity_state = 'ESTABLISHED' and is_integrity_eligible and branch_id is not null
      ))[1] as agreed_branch_id,
      count(*) filter (
        where lane = 'KIOSK' and evidence_kind = 'LOGICAL_IN'
          and integrity_state = 'ESTABLISHED' and is_integrity_eligible
      ) as kiosk_in_count,
      count(*) filter (
        where lane = 'KIOSK' and evidence_kind = 'LOGICAL_OUT'
          and integrity_state = 'ESTABLISHED' and is_integrity_eligible
      ) as kiosk_out_count,
      count(*) filter (
        where lane = 'KIOSK' and not (
          integrity_state = 'ESTABLISHED'
          and is_integrity_eligible
          and branch_id is not null
          and sufficiency_state = 'SUFFICIENT'
        )
      ) as kiosk_unreconciled_count,
      bool_or(
        lane in ('MANUAL_ADMIN', 'BULK_IMPORT')
        and evidence_kind = 'EXPLICIT_BRANCH'
        and integrity_state = 'ESTABLISHED'
        and is_integrity_eligible
        and sufficiency_state = 'SUFFICIENT'
        and branch_id is not null
        and authorization_namespace is not null
        and authorization_reference is not null
        and asserted_at is not null
        and (lane <> 'MANUAL_ADMIN' or asserted_by_entity_id is not null)
      ) as explicit_lane_sufficient,
      coalesce(array_agg(evidence_id order by evidence_id) filter (where evidence_id is not null), '{}'::uuid[]) as evidence_ids,
      md5(semantic_completion_mode || '|' || coalesce(string_agg(
        jsonb_build_array(
          evidence_id, lane, evidence_kind, branch_id, integrity_state,
          sufficiency_state, is_integrity_eligible, semantic_revision,
          source_namespace, source_observation_id, extract(epoch from occurred_at),
          asserted_by_entity_id, asserted_by_house_role, authorization_namespace,
          authorization_reference, extract(epoch from asserted_at)
        )::text,
        '|' order by evidence_id
      ) filter (where evidence_id is not null), '')) as basis_fingerprint
    from evidence_frame
    group by house_id, fact_id, employee_id, current_value_revision,
      evidence_basis_revision, semantic_completion_mode
  ), classified as (
    select *,
      case
        when established_branch_count > 1 then 'CONFLICT'
        when established_branch_count = 1 and (
          coalesce(explicit_lane_sufficient, false)
          or (semantic_completion_mode = 'OPEN' and kiosk_in_count = 1 and kiosk_out_count = 0 and kiosk_unreconciled_count = 0)
          or (semantic_completion_mode = 'COMPLETED' and kiosk_in_count = 1 and kiosk_out_count = 1 and kiosk_unreconciled_count = 0)
        ) then 'ATTRIBUTED'
        else 'UNATTRIBUTED'
      end as classification
    from aggregate_frame
  )
  insert into public.hr_attendance_authorization_projection (
    house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
    evidence_basis_fingerprint, attribution_state, active_branch_id,
    governing_evidence_ids, rebuilt_at
  )
  select
    house_id, fact_id, employee_id, current_value_revision, evidence_basis_revision,
    basis_fingerprint, classification,
    case when classification = 'ATTRIBUTED' then agreed_branch_id else null end,
    evidence_ids, now()
  from classified;

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

-- Resolve branch scope from trusted role/policy membership. A supplied House UUID
-- only selects a tenant to authorize; it never grants membership or branch scope.
create or replace function public.hr_read_canonical_attendance_branch_scoped(
  p_house_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  fact_id uuid, employee_id uuid, work_date date,
  time_in timestamptz, time_out timestamptz, hours_worked numeric,
  overtime_minutes integer, status text, active_branch_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_house_id is null or p_start_date is null or p_end_date is null
    or p_start_date > p_end_date or p_limit is null or p_limit < 1
    or p_limit > 200 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid canonical attendance read bounds' using errcode = '22023';
  end if;

  return query
  with actor as (
    select public.current_entity_id() as entity_id
  ), house_membership as (
    select a.entity_id
    from actor a
    where a.entity_id is not null
      and exists (
        select 1 from public.house_roles hr
        where hr.house_id = p_house_id and hr.entity_id = a.entity_id
      )
      and not exists (
        select 1 from public.house_roles hr
        where hr.house_id = p_house_id and hr.entity_id = a.entity_id
          and hr.role in ('house_owner', 'house_manager')
      )
  ), effective_feature_read as (
    select hm.entity_id
    from house_membership hm
    where exists (
      -- entity_policies is the canonical flattened effective-policy surface and
      -- includes both role-derived policies and direct PLATFORM-scoped grants.
      select 1 from public.entity_policies ep
      where ep.entity_id = hm.entity_id
        and ep.policy_key in ('tiles.hr.read', 'tiles.payroll.read')
        and (
          (ep.scope = 'PLATFORM' and ep.role_slug = 'direct')
          or (ep.scope = 'HOUSE' and ep.scope_ref = p_house_id)
        )
    )
  ), allowed_branches as (
    select distinct b.id
    from effective_feature_read afr
    join public.entity_policies ep
      on ep.entity_id = afr.entity_id
      and ep.scope = 'HOUSE' and ep.scope_ref = p_house_id
    cross join lateral (
      select substring(ep.policy_key from '(?i)^(?:hr[.]branch[.]|tiles[.]hr[.]branch[.]|hr:branch:|tiles:hr:branch:)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$')::uuid as id
    ) parsed
    join public.branches b on b.house_id = p_house_id and b.id = parsed.id
    where parsed.id is not null
  )
  select p.fact_id, p.employee_id, r.work_date,
    r.time_in, r.time_out, r.hours_worked, r.overtime_minutes, r.status,
    p.active_branch_id
  from public.hr_attendance_authorization_projection p
  join allowed_branches ab on ab.id = p.active_branch_id
  join public.hr_attendance_facts f
    on f.house_id = p.house_id and f.id = p.fact_id and f.is_active
    and f.current_value_revision = p.value_revision
    and f.evidence_basis_revision = p.evidence_basis_revision
  join public.hr_attendance_fact_revisions r
    on r.house_id = f.house_id and r.fact_id = f.id and r.revision = f.current_value_revision
  where p.house_id = p_house_id
    and r.work_date between p_start_date and p_end_date
    and (p_employee_id is null or (
      p.employee_id = p_employee_id
      and exists (
        select 1 from public.employees target
        where target.house_id = p_house_id and target.id = p_employee_id
      )
    ))
    and p.attribution_state = 'ATTRIBUTED'
    and p.active_branch_id is not null
    and p.evidence_basis_fingerprint = md5((
      select ef.semantic_completion_mode || '|' || coalesce((
        select string_agg(
          jsonb_build_array(
            e.id, e.lane, e.evidence_kind, e.branch_id, e.integrity_state,
            e.sufficiency_state, e.is_integrity_eligible, e.semantic_revision,
            o.source_namespace, o.source_observation_id, extract(epoch from o.occurred_at),
            e.asserted_by_entity_id, e.asserted_by_house_role, e.authorization_namespace,
            e.authorization_reference, extract(epoch from e.asserted_at)
          )::text,
          '|' order by e.id
        )
        from public.hr_attendance_fact_evidence a
        join public.hr_attendance_evidence e
          on e.house_id = a.house_id and e.id = a.evidence_id
        left join public.hr_attendance_observations o
          on o.house_id = e.house_id and o.id = e.observation_id
          and o.employee_id = e.employee_id
        where a.house_id = f.house_id and a.fact_id = f.id
          and a.evidence_basis_revision = f.evidence_basis_revision
      ), '')
      from public.hr_attendance_evidence_frames ef
      where ef.house_id = f.house_id and ef.fact_id = f.id
        and ef.evidence_basis_revision = f.evidence_basis_revision and ef.is_sealed
    ))
  order by r.work_date, r.time_in asc nulls last, p.fact_id
  limit p_limit offset p_offset;
end
$function$;

create or replace function public.hr_read_canonical_attendance_house_global(
  p_house_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  fact_id uuid, employee_id uuid, work_date date,
  time_in timestamptz, time_out timestamptz, hours_worked numeric,
  overtime_minutes integer, status text, attribution_state text, active_branch_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_house_id is null or p_start_date is null or p_end_date is null
    or p_start_date > p_end_date or p_limit is null or p_limit < 1
    or p_limit > 200 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid canonical attendance read bounds' using errcode = '22023';
  end if;

  return query
  select p.fact_id, p.employee_id, r.work_date,
    r.time_in, r.time_out, r.hours_worked, r.overtime_minutes, r.status,
    p.attribution_state, p.active_branch_id
  from public.hr_attendance_authorization_projection p
  join public.hr_attendance_facts f
    on f.house_id = p.house_id and f.id = p.fact_id and f.is_active
    and f.current_value_revision = p.value_revision
    and f.evidence_basis_revision = p.evidence_basis_revision
  join public.hr_attendance_fact_revisions r
    on r.house_id = f.house_id and r.fact_id = f.id and r.revision = f.current_value_revision
  where p.house_id = p_house_id
    and r.work_date between p_start_date and p_end_date
    and (p_employee_id is null or (
      p.employee_id = p_employee_id
      and exists (
        select 1 from public.employees target
        where target.house_id = p_house_id and target.id = p_employee_id
      )
    ))
    and exists (
      select 1 from public.house_roles hr
      where hr.house_id = p_house_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner', 'house_manager')
    )
    and p.attribution_state in ('ATTRIBUTED', 'UNATTRIBUTED', 'CONFLICT')
    and ((p.attribution_state = 'ATTRIBUTED' and p.active_branch_id is not null)
      or (p.attribution_state in ('UNATTRIBUTED', 'CONFLICT') and p.active_branch_id is null))
    and p.evidence_basis_fingerprint = md5((
      select ef.semantic_completion_mode || '|' || coalesce((
        select string_agg(
          jsonb_build_array(
            e.id, e.lane, e.evidence_kind, e.branch_id, e.integrity_state,
            e.sufficiency_state, e.is_integrity_eligible, e.semantic_revision,
            o.source_namespace, o.source_observation_id, extract(epoch from o.occurred_at),
            e.asserted_by_entity_id, e.asserted_by_house_role, e.authorization_namespace,
            e.authorization_reference, extract(epoch from e.asserted_at)
          )::text,
          '|' order by e.id
        )
        from public.hr_attendance_fact_evidence a
        join public.hr_attendance_evidence e
          on e.house_id = a.house_id and e.id = a.evidence_id
        left join public.hr_attendance_observations o
          on o.house_id = e.house_id and o.id = e.observation_id
          and o.employee_id = e.employee_id
        where a.house_id = f.house_id and a.fact_id = f.id
          and a.evidence_basis_revision = f.evidence_basis_revision
      ), '')
      from public.hr_attendance_evidence_frames ef
      where ef.house_id = f.house_id and ef.fact_id = f.id
        and ef.evidence_basis_revision = f.evidence_basis_revision and ef.is_sealed
    ))
  order by r.work_date, r.time_in asc nulls last, p.fact_id
  limit p_limit offset p_offset;
end
$function$;

alter table public.hr_attendance_observations enable row level security;
alter table public.hr_attendance_facts enable row level security;
alter table public.hr_attendance_fact_revisions enable row level security;
alter table public.hr_attendance_evidence enable row level security;
alter table public.hr_attendance_evidence_frames enable row level security;
alter table public.hr_attendance_fact_evidence enable row level security;
alter table public.hr_attendance_employee_generations enable row level security;
alter table public.hr_attendance_authorization_projection enable row level security;

revoke all on table public.hr_attendance_observations from public, anon, authenticated;
revoke all on table public.hr_attendance_facts from public, anon, authenticated;
revoke all on table public.hr_attendance_fact_revisions from public, anon, authenticated;
revoke all on table public.hr_attendance_evidence from public, anon, authenticated;
revoke all on table public.hr_attendance_evidence_frames from public, anon, authenticated;
revoke all on table public.hr_attendance_fact_evidence from public, anon, authenticated;
revoke all on table public.hr_attendance_employee_generations from public, anon, authenticated;
revoke all on table public.hr_attendance_authorization_projection from public, anon, authenticated;

revoke all on function public.hr_rebuild_attendance_authorization_projection(uuid) from public, anon, authenticated;
grant execute on function public.hr_rebuild_attendance_authorization_projection(uuid) to service_role;
revoke all on function public.hr_reject_attendance_history_mutation() from public, anon, authenticated;
revoke all on function public.hr_guard_attendance_evidence_frame() from public, anon, authenticated;
revoke all on function public.hr_guard_attendance_evidence_insert() from public, anon, authenticated;
revoke all on function public.hr_guard_attendance_frame_membership_insert() from public, anon, authenticated;
revoke all on function public.hr_guard_attendance_fact_revision_segment_insert() from public, anon, authenticated;
revoke all on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer) from public, anon;
grant execute on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer) to authenticated;
revoke all on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer) from public, anon;
grant execute on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer) to authenticated;

comment on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer) is
  'GAP-024 Gate A sanitized facts-only branch reader; branch authorization is derived from the authenticated actor.';
comment on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer) is
  'GAP-024 Gate A sanitized house-global reader restricted to house_owner/house_manager membership.';

notify pgrst, 'reload schema';
commit;
