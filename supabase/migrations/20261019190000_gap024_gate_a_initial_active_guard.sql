begin;

-- GAP-024 Gate A initial-active lifecycle guard.
--
-- An inactive canonical fact is a retirement tombstone of a previously active,
-- classified authority pair. New facts must therefore begin active at authority pair
-- (1,1); callers cannot create an already-retired fact that never entered canonical
-- projection/history.

create or replace function public.hr_guard_attendance_fact_activation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'INSERT' then
    if not new.is_active then
      raise exception 'Canonical attendance facts must begin active'
        using errcode = '55000';
    end if;
    if new.current_value_revision <> 1 or new.evidence_basis_revision <> 1 then
      raise exception 'Canonical attendance facts must begin at value revision and evidence basis 1'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.house_id is distinct from old.house_id
    or new.employee_id is distinct from old.employee_id then
    raise exception 'Canonical attendance fact identity and ownership are immutable'
      using errcode = '55000';
  end if;

  if not old.is_active and new.is_active then
    raise exception 'Retired canonical attendance facts cannot be reactivated'
      using errcode = '55000';
  end if;

  -- Retirement freezes the last classified authority pair. A retired fact cannot select
  -- a later value/evidence pair, and a transition that retires a fact cannot combine
  -- retirement with pointer advancement. Projection rebuilds intentionally ignore
  -- inactive facts, so allowing either shape would create an unclassified current pair
  -- on the tombstone.
  if (
    (not old.is_active or not new.is_active)
    and (
      new.current_value_revision is distinct from old.current_value_revision
      or new.evidence_basis_revision is distinct from old.evidence_basis_revision
    )
  ) then
    raise exception 'Retired canonical attendance fact authority pointers are immutable'
      using errcode = '55000';
  end if;

  -- Every authority pair that was actually current must be classified/persisted before
  -- it can be superseded or retired. This couples pointer activation to the append-only
  -- authorization-history audit without making ordinary non-authority updates depend on
  -- projection freshness.
  if (
    new.current_value_revision is distinct from old.current_value_revision
    or new.evidence_basis_revision is distinct from old.evidence_basis_revision
    or new.is_active is distinct from old.is_active
  ) then
    perform 1
    from public.hr_attendance_authorization_history h
    where h.house_id = old.house_id
      and h.fact_id = old.id
      and h.employee_id = old.employee_id
      and h.value_revision = old.current_value_revision
      and h.evidence_basis_revision = old.evidence_basis_revision;

    if not found then
      raise exception 'Current attendance authority pair must be classified before another authority change'
        using errcode = '55000';
    end if;
  end if;

  if new.current_value_revision < old.current_value_revision then
    raise exception 'Current attendance value revision cannot move backward'
      using errcode = '55000';
  end if;
  if new.evidence_basis_revision < old.evidence_basis_revision then
    raise exception 'Current attendance evidence basis cannot move backward'
      using errcode = '55000';
  end if;

  if new.current_value_revision > old.current_value_revision then
    perform 1
    from public.hr_attendance_fact_revisions target_revision
    where target_revision.house_id = old.house_id
      and target_revision.fact_id = old.id
      and target_revision.employee_id = old.employee_id
      and target_revision.revision = new.current_value_revision
      and target_revision.predecessor_revision = old.current_value_revision;
    if not found then
      raise exception 'Current attendance value revision must advance through its explicit predecessor'
        using errcode = '55000';
    end if;
  end if;

  if new.evidence_basis_revision > old.evidence_basis_revision then
    perform 1
    from public.hr_attendance_evidence_frames target_frame
    where target_frame.house_id = old.house_id
      and target_frame.fact_id = old.id
      and target_frame.employee_id = old.employee_id
      and target_frame.evidence_basis_revision = new.evidence_basis_revision
      and target_frame.predecessor_revision = old.evidence_basis_revision
      and target_frame.is_sealed;
    if not found then
      raise exception 'Current attendance evidence basis requires its next sealed frame'
        using errcode = '55000';
    end if;

    -- Omitting a currently governing lineage is its retirement boundary. Lock the
    -- omitted member in the same deterministic order used for activation and successor
    -- insertion, then reject retirement if a successor already exists. If retirement
    -- wins the lock, a later successor is post-retirement evidence and may re-enter only
    -- as a strict, unsuperseded descendant in a later basis.
    perform 1
    from public.hr_attendance_fact_evidence current_membership
    join public.hr_attendance_evidence current_evidence
      on current_evidence.house_id = current_membership.house_id
      and current_evidence.id = current_membership.evidence_id
      and current_evidence.employee_id = old.employee_id
    where current_membership.house_id = old.house_id
      and current_membership.fact_id = old.id
      and current_membership.evidence_basis_revision = old.evidence_basis_revision
      and not exists (
        select 1
        from public.hr_attendance_fact_evidence target_membership
        join public.hr_attendance_evidence target_evidence
          on target_evidence.house_id = target_membership.house_id
          and target_evidence.id = target_membership.evidence_id
          and target_evidence.employee_id = old.employee_id
        where target_membership.house_id = old.house_id
          and target_membership.fact_id = old.id
          and target_membership.evidence_basis_revision = new.evidence_basis_revision
          and target_evidence.lineage_root_evidence_id = current_evidence.lineage_root_evidence_id
      )
    order by current_evidence.lineage_root_evidence_id, current_evidence.id
    for update of current_evidence;

    if exists (
      select 1
      from public.hr_attendance_fact_evidence current_membership
      join public.hr_attendance_evidence current_evidence
        on current_evidence.house_id = current_membership.house_id
        and current_evidence.id = current_membership.evidence_id
        and current_evidence.employee_id = old.employee_id
      join public.hr_attendance_evidence successor
        on successor.house_id = current_evidence.house_id
        and successor.employee_id = current_evidence.employee_id
        and successor.lineage_root_evidence_id = current_evidence.lineage_root_evidence_id
        and successor.supersedes_evidence_id = current_evidence.id
      where current_membership.house_id = old.house_id
        and current_membership.fact_id = old.id
        and current_membership.evidence_basis_revision = old.evidence_basis_revision
        and not exists (
          select 1
          from public.hr_attendance_fact_evidence target_membership
          join public.hr_attendance_evidence target_evidence
            on target_evidence.house_id = target_membership.house_id
            and target_evidence.id = target_membership.evidence_id
            and target_evidence.employee_id = old.employee_id
          where target_membership.house_id = old.house_id
            and target_membership.fact_id = old.id
            and target_membership.evidence_basis_revision = new.evidence_basis_revision
            and target_evidence.lineage_root_evidence_id = current_evidence.lineage_root_evidence_id
        )
    ) then
      raise exception 'Current evidence lineage cannot retire after its governing member was superseded'
        using errcode = '55000';
    end if;

    -- A lineage absent from the immediately current basis was already retired. It may
    -- return only through a strict descendant, never by reselecting a member that
    -- governed before its retirement boundary.
    if exists (
      select 1
      from public.hr_attendance_fact_evidence target_membership
      join public.hr_attendance_evidence target_evidence
        on target_evidence.house_id = target_membership.house_id
        and target_evidence.id = target_membership.evidence_id
        and target_evidence.employee_id = old.employee_id
      where target_membership.house_id = old.house_id
        and target_membership.fact_id = old.id
        and target_membership.evidence_basis_revision = new.evidence_basis_revision
        and not exists (
          select 1
          from public.hr_attendance_fact_evidence current_membership
          join public.hr_attendance_evidence current_evidence
            on current_evidence.house_id = current_membership.house_id
            and current_evidence.id = current_membership.evidence_id
            and current_evidence.employee_id = old.employee_id
          where current_membership.house_id = old.house_id
            and current_membership.fact_id = old.id
            and current_membership.evidence_basis_revision = old.evidence_basis_revision
            and current_evidence.lineage_root_evidence_id = target_evidence.lineage_root_evidence_id
        )
        and exists (
          select 1
          from public.hr_attendance_fact_evidence prior_membership
          where prior_membership.house_id = old.house_id
            and prior_membership.fact_id = old.id
            and prior_membership.evidence_basis_revision < old.evidence_basis_revision
            and prior_membership.evidence_id = target_evidence.id
        )
    ) then
      raise exception 'Retired evidence lineage must re-enter through a strict successor'
        using errcode = '55000';
    end if;

    -- Every entering/re-entering target and every continuous-lineage target that advances
    -- to a different member must select an unsuperseded leaf. Exact same-member
    -- carry-forward remains valid even after a successor is appended. Lock each target
    -- requiring leafness in immutable lineage/id order before checking for successors;
    -- the ancestry-path rule below remains a separate requirement.
    perform 1
    from public.hr_attendance_fact_evidence target_membership
    join public.hr_attendance_evidence target_evidence
      on target_evidence.house_id = target_membership.house_id
      and target_evidence.id = target_membership.evidence_id
      and target_evidence.employee_id = old.employee_id
    where target_membership.house_id = old.house_id
      and target_membership.fact_id = old.id
      and target_membership.evidence_basis_revision = new.evidence_basis_revision
      and not exists (
        select 1
        from public.hr_attendance_fact_evidence current_membership
        join public.hr_attendance_evidence current_evidence
          on current_evidence.house_id = current_membership.house_id
          and current_evidence.id = current_membership.evidence_id
          and current_evidence.employee_id = old.employee_id
        where current_membership.house_id = old.house_id
          and current_membership.fact_id = old.id
          and current_membership.evidence_basis_revision = old.evidence_basis_revision
          and current_evidence.lineage_root_evidence_id = target_evidence.lineage_root_evidence_id
          and current_evidence.id = target_evidence.id
      )
    order by target_evidence.lineage_root_evidence_id, target_evidence.id
    for update of target_evidence;

    if exists (
      select 1
      from public.hr_attendance_fact_evidence target_membership
      join public.hr_attendance_evidence target_evidence
        on target_evidence.house_id = target_membership.house_id
        and target_evidence.id = target_membership.evidence_id
        and target_evidence.employee_id = old.employee_id
      join public.hr_attendance_evidence successor
        on successor.house_id = target_evidence.house_id
        and successor.employee_id = target_evidence.employee_id
        and successor.lineage_root_evidence_id = target_evidence.lineage_root_evidence_id
        and successor.supersedes_evidence_id = target_evidence.id
      where target_membership.house_id = old.house_id
        and target_membership.fact_id = old.id
        and target_membership.evidence_basis_revision = new.evidence_basis_revision
        and not exists (
          select 1
          from public.hr_attendance_fact_evidence current_membership
          join public.hr_attendance_evidence current_evidence
            on current_evidence.house_id = current_membership.house_id
            and current_evidence.id = current_membership.evidence_id
            and current_evidence.employee_id = old.employee_id
          where current_membership.house_id = old.house_id
            and current_membership.fact_id = old.id
            and current_membership.evidence_basis_revision = old.evidence_basis_revision
            and current_evidence.lineage_root_evidence_id = target_evidence.lineage_root_evidence_id
            and current_evidence.id = target_evidence.id
        )
    ) then
      raise exception 'Target current evidence must be an unsuperseded lineage member'
        using errcode = '55000';
    end if;

    -- Starting at each target member and walking explicit supersession links toward
    -- its root is the only authority comparison. Every previously governing member
    -- of that lineage must be on this ancestry path; timestamps, UUID order, and
    -- semantic revision maxima do not select authority.
    if exists (
      with recursive target_ancestry as (
        select target_evidence.lineage_root_evidence_id,
          target_evidence.id as target_evidence_id,
          target_evidence.id as ancestor_evidence_id,
          target_evidence.supersedes_evidence_id
        from public.hr_attendance_fact_evidence target_membership
        join public.hr_attendance_evidence target_evidence
          on target_evidence.house_id = target_membership.house_id
          and target_evidence.id = target_membership.evidence_id
          and target_evidence.employee_id = old.employee_id
        where target_membership.house_id = old.house_id
          and target_membership.fact_id = old.id
          and target_membership.evidence_basis_revision = new.evidence_basis_revision
        union all
        select ancestry.lineage_root_evidence_id,
          ancestry.target_evidence_id,
          predecessor.id,
          predecessor.supersedes_evidence_id
        from target_ancestry ancestry
        join public.hr_attendance_evidence predecessor
          on predecessor.house_id = old.house_id
          and predecessor.id = ancestry.supersedes_evidence_id
          and predecessor.employee_id = old.employee_id
      ), prior_governing_members as (
        select prior_evidence.lineage_root_evidence_id,
          prior_evidence.id as evidence_id
        from public.hr_attendance_fact_evidence prior_membership
        join public.hr_attendance_evidence prior_evidence
          on prior_evidence.house_id = prior_membership.house_id
          and prior_evidence.id = prior_membership.evidence_id
          and prior_evidence.employee_id = old.employee_id
        where prior_membership.house_id = old.house_id
          and prior_membership.fact_id = old.id
          and prior_membership.evidence_basis_revision <= old.evidence_basis_revision
      )
      select 1
      from prior_governing_members prior
      where exists (
        select 1 from target_ancestry target_lineage
        where target_lineage.lineage_root_evidence_id = prior.lineage_root_evidence_id
      )
      and not exists (
        select 1 from target_ancestry permitted_path
        where permitted_path.lineage_root_evidence_id = prior.lineage_root_evidence_id
          and permitted_path.ancestor_evidence_id = prior.evidence_id
      )
    ) then
      raise exception 'Current evidence authority cannot regress or switch supersession paths'
        using errcode = '55000';
    end if;
  end if;

  return new;
end
$function$;

revoke all on function public.hr_guard_attendance_fact_activation()
  from public, anon, authenticated, service_role;

comment on function public.hr_guard_attendance_fact_activation() is
  'GAP-024 Gate A SECURITY DEFINER activation guard: new facts begin active at 1/1; retired facts freeze their final classified authority pair; active authority changes require durable prior classification history.';

commit;
