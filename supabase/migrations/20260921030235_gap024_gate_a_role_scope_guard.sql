-- GAP-024 Gate A role-scope compatibility hardening.
--
-- The preceding live/replay compatibility migrations are already applied to the restored
-- live Supabase project. Historical repository replay permits identical custom role slugs
-- in different Houses through roles(scope='HOUSE', scope_ref), while the current live
-- role table is globally keyed and has no scope_ref column. Keep role resolution shape-
-- aware so a requested-House membership cannot inherit policy rows from a same-named
-- role belonging to another House. PLATFORM role resolution is similarly constrained so
-- a platform role name cannot bind a House/Guild role with the same text.
--
-- Public RPC signature, return shape, House membership requirement, owner/manager
-- exclusion, capability semantics, branch restriction, grants and PostgREST reload are
-- unchanged.

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
        select 1
        from public.house_roles hr
        where hr.house_id = p_house_id
          and hr.entity_id = a.entity_id
      )
      and not exists (
        select 1
        from public.house_roles hr
        where hr.house_id = p_house_id
          and hr.entity_id = a.entity_id
          and lower(btrim(hr.role)) in (
            'house_owner', 'business_owner', 'house_manager',
            'business_admin', 'business_manager'
          )
      )
  ), direct_policy_keys as (
    -- The confirmed live entity_policies object is a direct assignment table
    -- (entity_id, policy_id), while historical replay may expose the old flattened
    -- effective-policy view. A scope-less row is therefore a live direct/global grant;
    -- on the historical view only PLATFORM rows may satisfy global feature capability.
    -- HOUSE/GUILD rows from the old view must not be accidentally promoted to global.
    select distinct hm.entity_id, p.key as policy_key
    from house_membership hm
    join public.entity_policies ep on ep.entity_id = hm.entity_id
    join public.policies p on p.id = ep.policy_id
    where not (to_jsonb(ep) ? 'scope')
       or upper(btrim(coalesce(to_jsonb(ep) ->> 'scope', ''))) = 'PLATFORM'
  ), platform_policy_keys as (
    -- PLATFORM role-derived capability is also global. It may satisfy feature-read
    -- capability, but it never contributes branch scope.
    select distinct hm.entity_id, p.key as policy_key
    from house_membership hm
    join public.platform_roles pr on pr.entity_id = hm.entity_id
    cross join lateral unnest(pr.roles) assigned_role(role_key)
    join public.roles r
      on (
        lower(btrim(coalesce(to_jsonb(r) ->> 'slug', ''))) = lower(btrim(assigned_role.role_key))
        or lower(btrim(coalesce(to_jsonb(r) ->> 'key', ''))) = lower(btrim(assigned_role.role_key))
      )
     and (
       (
         to_jsonb(r) ? 'scope_ref'
         and upper(btrim(coalesce(to_jsonb(r) ->> 'scope', ''))) = 'PLATFORM'
         and nullif(to_jsonb(r) ->> 'scope_ref', '') is null
       )
       or (
         not (to_jsonb(r) ? 'scope_ref')
         and (
           nullif(to_jsonb(r) ->> 'scope', '') is null
           or lower(btrim(to_jsonb(r) ->> 'scope')) = 'platform'
         )
       )
     )
    join public.role_policies rp on rp.role_id = r.id
    join public.policies p on p.id = rp.policy_id
  ), house_policy_keys as (
    -- House-scoped policy capability is derived from the actor's requested-House
    -- membership. Prefer the explicit role_id when present; otherwise resolve the
    -- current role text against the live role key/slug compatibility surface.
    select distinct hm.entity_id, p.key as policy_key
    from house_membership hm
    join public.house_roles hr
      on hr.house_id = p_house_id
     and hr.entity_id = hm.entity_id
    join public.roles r
      on (
        (
          nullif(to_jsonb(hr) ->> 'role_id', '') is not null
          and r.id = (to_jsonb(hr) ->> 'role_id')::uuid
        )
        or (
          nullif(to_jsonb(hr) ->> 'role_id', '') is null
          and (
            lower(btrim(coalesce(to_jsonb(r) ->> 'slug', ''))) = lower(btrim(hr.role))
            or lower(btrim(coalesce(to_jsonb(r) ->> 'key', ''))) = lower(btrim(hr.role))
          )
        )
      )
     and (
       (
         to_jsonb(r) ? 'scope_ref'
         and upper(btrim(coalesce(to_jsonb(r) ->> 'scope', ''))) = 'HOUSE'
         and (
           nullif(to_jsonb(r) ->> 'scope_ref', '') is null
           or (to_jsonb(r) ->> 'scope_ref')::uuid = p_house_id
         )
       )
       or (
         not (to_jsonb(r) ? 'scope_ref')
         and (
           nullif(to_jsonb(r) ->> 'scope', '') is null
           or lower(btrim(to_jsonb(r) ->> 'scope')) in ('house', 'workspace')
         )
       )
     )
    join public.role_policies rp on rp.role_id = r.id
    join public.policies p on p.id = rp.policy_id
  ), effective_feature_read as (
    select hm.entity_id
    from house_membership hm
    where exists (
      select 1
      from (
        select dpk.policy_key
        from direct_policy_keys dpk
        where dpk.entity_id = hm.entity_id
        union all
        select ppk.policy_key
        from platform_policy_keys ppk
        where ppk.entity_id = hm.entity_id
        union all
        select hpk.policy_key
        from house_policy_keys hpk
        where hpk.entity_id = hm.entity_id
      ) effective_policy
      where effective_policy.policy_key in ('tiles.hr.read', 'tiles.payroll.read')
    )
  ), allowed_branches as (
    -- Branch scope is restriction-only and may come only from requested-House role
    -- policy assignments. Direct/PLATFORM grants cannot manufacture branch scope.
    select distinct b.id
    from effective_feature_read afr
    join house_policy_keys hpk on hpk.entity_id = afr.entity_id
    cross join lateral (
      select substring(hpk.policy_key from '(?i)^(?:hr[.]branch[.]|tiles[.]hr[.]branch[.]|hr:branch:|tiles:hr:branch:)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$')::uuid as id
    ) parsed
    join public.branches b
      on b.house_id = p_house_id
     and b.id = parsed.id
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

revoke all on function public.hr_read_canonical_attendance_branch_scoped(
  uuid, date, date, uuid, integer, integer
) from public, anon;

grant execute on function public.hr_read_canonical_attendance_branch_scoped(
  uuid, date, date, uuid, integer, integer
) to authenticated;

comment on function public.hr_read_canonical_attendance_branch_scoped(
  uuid, date, date, uuid, integer, integer
) is 'GAP-024 Gate A sanitized branch-scoped reader with live/replay policy-shape compatibility and exact requested-House role-scope resolution.';

notify pgrst, 'reload schema';
