begin;

-- GAP-024 Gate A historical-classification retention follow-up.
--
-- The current projection is intentionally one row per current fact, but the frozen
-- contract also requires prior governing classifications to remain durable for
-- authorized audit. Preserve each exact value/evidence revision pair and its resulting
-- classification in a separate append-only history table.

create table public.hr_attendance_authorization_history (
  house_id uuid not null,
  fact_id uuid not null,
  employee_id uuid not null,
  value_revision bigint not null check (value_revision > 0),
  evidence_basis_revision bigint not null check (evidence_basis_revision > 0),
  evidence_basis_fingerprint text not null,
  attribution_state text not null
    check (attribution_state in ('ATTRIBUTED', 'UNATTRIBUTED', 'CONFLICT')),
  active_branch_id uuid,
  governing_evidence_ids uuid[] not null default '{}'::uuid[],
  projected_at timestamptz not null default now(),
  primary key (house_id, fact_id, value_revision, evidence_basis_revision),
  constraint hr_attendance_authorization_history_fact_fk
    foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id)
    on delete restrict,
  constraint hr_attendance_authorization_history_revision_fk
    foreign key (house_id, fact_id, value_revision)
    references public.hr_attendance_fact_revisions(house_id, fact_id, revision)
    on delete restrict,
  constraint hr_attendance_authorization_history_frame_fk
    foreign key (house_id, fact_id, evidence_basis_revision)
    references public.hr_attendance_evidence_frames(house_id, fact_id, evidence_basis_revision)
    on delete restrict,
  constraint hr_attendance_authorization_history_house_employee_fk
    foreign key (house_id, employee_id)
    references public.employees(house_id, id)
    on delete restrict,
  constraint hr_attendance_authorization_history_house_branch_fk
    foreign key (house_id, active_branch_id)
    references public.branches(house_id, id)
    on delete restrict,
  constraint hr_attendance_authorization_history_state_branch_check check (
    (attribution_state = 'ATTRIBUTED' and active_branch_id is not null)
    or (attribution_state in ('UNATTRIBUTED', 'CONFLICT') and active_branch_id is null)
  )
);

create index hr_attendance_authorization_history_fact_time_idx
  on public.hr_attendance_authorization_history (house_id, fact_id, projected_at);

create trigger hr_attendance_authorization_history_immutable
before update or delete on public.hr_attendance_authorization_history
for each row execute function public.hr_reject_attendance_history_mutation();

alter table public.hr_attendance_authorization_history enable row level security;

revoke all on table public.hr_attendance_authorization_history
  from public, anon, authenticated, service_role;

-- Backfill any already-published current projection row exactly once. This migration is
-- safe before Gate-B population as well as on an environment that already has a current
-- projection.
insert into public.hr_attendance_authorization_history (
  house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
  evidence_basis_fingerprint, attribution_state, active_branch_id,
  governing_evidence_ids, projected_at
)
select
  p.house_id, p.fact_id, p.employee_id, p.value_revision, p.evidence_basis_revision,
  p.evidence_basis_fingerprint, p.attribution_state, p.active_branch_id,
  p.governing_evidence_ids, p.rebuilt_at
from public.hr_attendance_authorization_projection p
on conflict (house_id, fact_id, value_revision, evidence_basis_revision) do nothing;

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

  -- A fixed-seed PostgreSQL extended hash maps each House UUID into the bigint
  -- transaction-advisory namespace. Same-House rebuilds therefore share a lock until
  -- transaction end; different UUIDs normally remain independent. A theoretical
  -- 64-bit collision only causes conservative cross-House waiting, never mixed data.
  -- This lock serializes projection replacement only, not attendance writers.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('gap024.attendance_projection:' || p_house_id::text, 0)
  );

  -- Preserve the exact prior current value/evidence pair and its classification before
  -- replacing the one-row-per-current-fact projection. This is append-only audit authority.
  insert into public.hr_attendance_authorization_history (
    house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
    evidence_basis_fingerprint, attribution_state, active_branch_id,
    governing_evidence_ids, projected_at
  )
  select
    p.house_id, p.fact_id, p.employee_id, p.value_revision, p.evidence_basis_revision,
    p.evidence_basis_fingerprint, p.attribution_state, p.active_branch_id,
    p.governing_evidence_ids, p.rebuilt_at
  from public.hr_attendance_authorization_projection p
  where p.house_id = p_house_id
  on conflict (house_id, fact_id, value_revision, evidence_basis_revision) do nothing;

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
      case
        when ef.semantic_completion_mode = 'OPEN'
          then current_revision.time_out is null
            and lower(current_revision.status) in ('open', 'corrected')
        when ef.semantic_completion_mode = 'COMPLETED'
          then lower(current_revision.status) in ('open', 'closed', 'corrected')
        else false
      end as kiosk_completion_consistent,
      e.id as evidence_id,
      e.lane,
      e.evidence_kind,
      e.branch_id,
      e.integrity_state,
      e.integrity_reason_class,
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
      e.asserted_at,
      case
        when e.integrity_state = 'ESTABLISHED'
          and e.is_integrity_eligible
          and e.branch_id is not null
          and (
            (e.lane = 'KIOSK' and e.evidence_kind in ('LOGICAL_IN', 'LOGICAL_OUT'))
            or (
              e.lane in ('MANUAL_ADMIN', 'BULK_IMPORT')
              and e.evidence_kind = 'EXPLICIT_BRANCH'
              and e.authorization_namespace is not null
              and length(btrim(e.authorization_namespace)) > 0
              and e.authorization_reference is not null
              and length(btrim(e.authorization_reference)) > 0
              and e.asserted_at is not null
              and (
                e.lane <> 'MANUAL_ADMIN'
                or (e.asserted_by_entity_id is not null and e.asserted_by_house_role is not null)
              )
            )
          )
        then true
        else false
      end as conflict_branch_applicable
    from public.hr_attendance_facts f
    join public.hr_attendance_evidence_frames ef
      on ef.house_id = f.house_id and ef.fact_id = f.id
      and ef.employee_id = f.employee_id
      and ef.evidence_basis_revision = f.evidence_basis_revision
      and ef.is_sealed
    join public.hr_attendance_fact_revisions current_revision
      on current_revision.house_id = f.house_id
      and current_revision.fact_id = f.id
      and current_revision.employee_id = f.employee_id
      and current_revision.revision = f.current_value_revision
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
      kiosk_completion_consistent,
      count(distinct branch_id) filter (
        where conflict_branch_applicable
      ) as established_branch_count,
      (array_agg(distinct branch_id order by branch_id) filter (
        where conflict_branch_applicable
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
        conflict_branch_applicable
        and lane in ('MANUAL_ADMIN', 'BULK_IMPORT')
        and sufficiency_state = 'SUFFICIENT'
      ) as explicit_lane_sufficient,
      coalesce(array_agg(evidence_id order by evidence_id) filter (where evidence_id is not null), '{}'::uuid[]) as evidence_ids,
      md5(semantic_completion_mode || '|' || coalesce(string_agg(
        jsonb_build_array(
          evidence_id, lane, evidence_kind, branch_id, integrity_state, integrity_reason_class,
          sufficiency_state, is_integrity_eligible, semantic_revision,
          source_namespace, source_observation_id, extract(epoch from occurred_at),
          asserted_by_entity_id, asserted_by_house_role, authorization_namespace,
          authorization_reference, extract(epoch from asserted_at)
        )::text,
        '|' order by evidence_id
      ) filter (where evidence_id is not null), '')) as basis_fingerprint
    from evidence_frame
    group by house_id, fact_id, employee_id, current_value_revision,
      evidence_basis_revision, semantic_completion_mode, kiosk_completion_consistent
  ), classified as (
    select *,
      case
        when established_branch_count > 1 then 'CONFLICT'
        when established_branch_count = 1 and (
          coalesce(explicit_lane_sufficient, false)
          or (kiosk_completion_consistent and (
            (semantic_completion_mode = 'OPEN' and kiosk_in_count = 1 and kiosk_out_count = 0 and kiosk_unreconciled_count = 0)
            or (semantic_completion_mode = 'COMPLETED' and kiosk_in_count = 1 and kiosk_out_count = 1 and kiosk_unreconciled_count = 0)
          ))
        ) then 'ATTRIBUTED'
        else 'UNATTRIBUTED'
      end as classification
    from aggregate_frame
  ), history_write as (
    insert into public.hr_attendance_authorization_history (
      house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
      evidence_basis_fingerprint, attribution_state, active_branch_id,
      governing_evidence_ids, projected_at
    )
    select
      house_id, fact_id, employee_id, current_value_revision, evidence_basis_revision,
      basis_fingerprint, classification,
      case when classification = 'ATTRIBUTED' then agreed_branch_id else null end,
      evidence_ids, now()
    from classified
    on conflict (house_id, fact_id, value_revision, evidence_basis_revision) do nothing
    returning 1
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

comment on table public.hr_attendance_authorization_history is
  'GAP-024 Gate A append-only historical record of each exact value/evidence revision pair that was published as current, including its canonical classification.';

notify pgrst, 'reload schema';

commit;
