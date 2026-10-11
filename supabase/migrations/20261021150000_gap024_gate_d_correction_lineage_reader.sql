begin;

-- GAP-024 Gate D Option 1A:
-- Preserve payroll's corrected-day signal without repurposing attendance completion
-- status. The boolean is derived from finalized correction lineage only and is exposed
-- only through the already-authorized canonical readers.

drop function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer);
drop function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer);

create function public.hr_read_canonical_attendance_branch_scoped(
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
  overtime_minutes integer, status text, active_branch_id uuid,
  has_finalized_correction boolean
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
          and lower(btrim(hr.role)) in (
            'house_owner', 'business_owner', 'house_manager',
            'business_admin', 'business_manager'
          )
      )
  ), effective_feature_read as (
    select hm.entity_id
    from house_membership hm
    where exists (
      select 1 from public.entity_policies ep
      where ep.entity_id = hm.entity_id
        and ep.policy_key in ('tiles.hr.read', 'tiles.payroll.read')
        and (
          ep.scope = 'PLATFORM'
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
    p.active_branch_id,
    exists (
      select 1
      from public.hr_attendance_correction_cases c
      where c.house_id = p.house_id
        and c.fact_id = p.fact_id
        and c.lifecycle_status = 'FINALIZED'
    ) as has_finalized_correction
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
            e.id, e.lane, e.evidence_kind, e.branch_id, e.integrity_state, e.integrity_reason_class,
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

create function public.hr_read_canonical_attendance_house_global(
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
  overtime_minutes integer, status text, attribution_state text, active_branch_id uuid,
  has_finalized_correction boolean
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
    p.attribution_state, p.active_branch_id,
    exists (
      select 1
      from public.hr_attendance_correction_cases c
      where c.house_id = p.house_id
        and c.fact_id = p.fact_id
        and c.lifecycle_status = 'FINALIZED'
    ) as has_finalized_correction
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
        and lower(btrim(hr.role)) in (
          'house_owner', 'business_owner', 'house_manager',
          'business_admin', 'business_manager'
        )
    )
    and p.attribution_state in ('ATTRIBUTED', 'UNATTRIBUTED', 'CONFLICT')
    and ((p.attribution_state = 'ATTRIBUTED' and p.active_branch_id is not null)
      or (p.attribution_state in ('UNATTRIBUTED', 'CONFLICT') and p.active_branch_id is null))
    and p.evidence_basis_fingerprint = md5((
      select ef.semantic_completion_mode || '|' || coalesce((
        select string_agg(
          jsonb_build_array(
            e.id, e.lane, e.evidence_kind, e.branch_id, e.integrity_state, e.integrity_reason_class,
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

revoke all on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer)
  from public, anon;
grant execute on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer)
  to authenticated, service_role;

revoke all on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer)
  from public, anon;
grant execute on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer)
  to authenticated, service_role;

comment on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer) is
  'GAP-024 canonical branch reader; includes finalized-correction lineage boolean without exposing correction details.';
comment on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer) is
  'GAP-024 canonical house-global reader; includes finalized-correction lineage boolean without exposing correction details.';

notify pgrst, 'reload schema';
commit;
