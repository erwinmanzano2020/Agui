begin;

-- GAP-024 Gate A frame-membership lock-order correction.
--
-- Frame sealing holds the evidence-frame row before its trigger locks selected evidence.
-- Membership insertion must acquire those resources in the same order. Locking evidence
-- first and the frame last creates a concrete frame->evidence / evidence->frame deadlock.
-- Preserve all membership semantics and move only the unsealed-frame lock to the front.

create or replace function public.hr_guard_attendance_frame_membership_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_observation_id uuid;
  v_lineage_root_evidence_id uuid;
begin
  -- Lock the target frame before any evidence/lineage row. The frame-sealing UPDATE
  -- already owns this row before its guard locks selected evidence, so membership must
  -- follow the same frame -> evidence order to avoid a frame/evidence deadlock.
  perform 1
  from public.hr_attendance_evidence_frames ef
  where ef.house_id = new.house_id
    and ef.fact_id = new.fact_id
    and ef.employee_id = new.employee_id
    and ef.evidence_basis_revision = new.evidence_basis_revision
    and not ef.is_sealed
  for update;
  if not found then
    raise exception 'Evidence membership requires an unsealed matching frame'
      using errcode = '55000';
  end if;

  -- Resolve immutable lock keys only after the frame lock. Observation-backed
  -- membership then follows the existing observation -> evidence -> lineage-root order
  -- used by evidence insertion.
  select e.observation_id, e.lineage_root_evidence_id
    into v_observation_id, v_lineage_root_evidence_id
  from public.hr_attendance_evidence e
    where e.house_id = new.house_id and e.id = new.evidence_id
      and e.employee_id = new.employee_id;
  if not found then
    raise exception 'Evidence membership requires matching House and employee ownership'
      using errcode = '23503';
  end if;

  if v_observation_id is not null then
    perform 1 from public.hr_attendance_observations o
      where o.house_id = new.house_id and o.id = v_observation_id
        and o.employee_id = new.employee_id
      for update;
  end if;

  perform 1 from public.hr_attendance_evidence evidence_member
    where evidence_member.house_id = new.house_id
      and evidence_member.id = new.evidence_id
      and evidence_member.employee_id = new.employee_id
      and evidence_member.lineage_root_evidence_id = v_lineage_root_evidence_id
    for update;
  if not found then
    raise exception 'Evidence membership authority changed while acquiring its lock'
      using errcode = '55000';
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

  -- A sealed-basis candidate is one current semantic set: after the common root
  -- lock, reject any second revision or sibling from this lineage in this frame.
  if exists (
    select 1
    from public.hr_attendance_fact_evidence frame_member
    join public.hr_attendance_evidence frame_evidence
      on frame_evidence.house_id = frame_member.house_id
      and frame_evidence.id = frame_member.evidence_id
    where frame_member.house_id = new.house_id
      and frame_member.fact_id = new.fact_id
      and frame_member.evidence_basis_revision = new.evidence_basis_revision
      and frame_evidence.lineage_root_evidence_id = v_lineage_root_evidence_id
      and frame_member.evidence_id <> new.evidence_id
  ) then
    raise exception 'An evidence frame may contain only one member of a semantic lineage'
      using errcode = '23514';
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

  return new;
end
$function$;

comment on function public.hr_guard_attendance_frame_membership_insert() is
  'GAP-024 Gate A membership guard: locks unsealed frame before observation/evidence/lineage rows to preserve deterministic frame->evidence lock ordering with concurrent sealing.';

commit;
