-- GAP-024 Gate B final reconcile + raw-mutation privilege cutover.
-- Apply only in the owner-approved coordinated deployment after all application writers
-- are running the Gate-B command paths. This migration is intentionally all-or-nothing.
begin;

lock table public.dtr_segments in share row exclusive mode;

do $block$
declare
  v_segment public.dtr_segments%rowtype;
  v_fact_id uuid;
  v_fact public.hr_attendance_facts%rowtype;
  v_in_event public.hr_kiosk_events%rowtype;
  v_out_event public.hr_kiosk_events%rowtype;
  v_total_count bigint;
  v_in_count bigint;
  v_out_count bigint;
  v_stable_count bigint;
  v_unique_source_count bigint;
  v_device_context_count bigint;
  v_branch_count bigint;
  v_timestamp_match_count bigint;
  v_next_basis bigint;
  v_observation_id uuid;
  v_evidence_id uuid;
begin
  for v_segment in
    select segment.*
    from public.dtr_segments segment
    where segment.canonical_fact_id is null
    order by segment.house_id, segment.employee_id, segment.work_date, segment.id
    for update
  loop
    v_fact_id := public.hr_attendance_bootstrap_unattributed_segment(
      v_segment.house_id,
      v_segment.id
    );

    -- JSON segment linkage is only a migration candidate locator. Establish kiosk
    -- provenance only when every governing boundary also has a unique opaque clientId,
    -- exact occurrence time, one branch, and exact OPEN/COMPLETED cardinality.
    if v_segment.source = 'system' then
      select
        count(*),
        count(*) filter (where event.event_type = 'clock_in'),
        count(*) filter (where event.event_type = 'clock_out'),
        count(*) filter (
          where nullif(btrim(event.metadata ->> 'clientId'), '') is not null
        ),
        count(*) filter (
          where nullif(btrim(event.metadata ->> 'clientId'), '') is not null
            and not exists (
              select 1
              from public.hr_kiosk_events duplicate_event
              where duplicate_event.house_id = event.house_id
                and duplicate_event.id <> event.id
                and duplicate_event.event_type in ('clock_in', 'clock_out')
                and nullif(btrim(duplicate_event.metadata ->> 'clientId'), '') =
                    nullif(btrim(event.metadata ->> 'clientId'), '')
            )
        ),
        count(*) filter (
          where event.device_id is not null
            and exists (
              select 1
              from public.hr_kiosk_devices device
              where device.id = event.device_id
                and device.house_id = event.house_id
                and device.branch_id = event.branch_id
                and device.is_active = true
            )
        ),
        count(distinct event.branch_id),
        count(*) filter (
          where (event.event_type = 'clock_in' and event.occurred_at = v_segment.time_in)
             or (event.event_type = 'clock_out' and event.occurred_at = v_segment.time_out)
        )
      into
        v_total_count,
        v_in_count,
        v_out_count,
        v_stable_count,
        v_unique_source_count,
        v_device_context_count,
        v_branch_count,
        v_timestamp_match_count
      from public.hr_kiosk_events event
      where event.house_id = v_segment.house_id
        and event.employee_id = v_segment.employee_id
        and event.event_type in ('clock_in', 'clock_out')
        and nullif(event.metadata ->> 'segmentId', '') = v_segment.id::text;

      if (
        (
          v_segment.time_out is null
          and v_total_count = 1
          and v_in_count = 1
          and v_out_count = 0
        )
        or (
          v_segment.time_out is not null
          and v_total_count = 2
          and v_in_count = 1
          and v_out_count = 1
        )
      )
      and v_stable_count = v_total_count
      and v_unique_source_count = v_total_count
      and v_device_context_count = v_total_count
      and v_branch_count = 1
      and v_timestamp_match_count = v_total_count then

        select event.*
        into strict v_in_event
        from public.hr_kiosk_events event
        where event.house_id = v_segment.house_id
          and event.employee_id = v_segment.employee_id
          and event.event_type = 'clock_in'
          and nullif(event.metadata ->> 'segmentId', '') = v_segment.id::text;

        if v_segment.time_out is not null then
          select event.*
          into strict v_out_event
          from public.hr_kiosk_events event
          where event.house_id = v_segment.house_id
            and event.employee_id = v_segment.employee_id
            and event.event_type = 'clock_out'
            and nullif(event.metadata ->> 'segmentId', '') = v_segment.id::text;
        end if;

        select fact.*
        into strict v_fact
        from public.hr_attendance_facts fact
        where fact.house_id = v_segment.house_id
          and fact.id = v_fact_id
          and fact.employee_id = v_segment.employee_id
        for update;

        v_next_basis := v_fact.evidence_basis_revision + 1;

        insert into public.hr_attendance_evidence_frames (
          house_id, fact_id, employee_id, evidence_basis_revision,
          predecessor_revision, semantic_completion_mode, is_sealed
        )
        values (
          v_segment.house_id, v_fact_id, v_segment.employee_id, v_next_basis,
          v_fact.evidence_basis_revision,
          case when v_segment.time_out is null then 'OPEN' else 'COMPLETED' end,
          false
        );

        v_observation_id := gen_random_uuid();
        v_evidence_id := gen_random_uuid();

        insert into public.hr_attendance_observations (
          id, house_id, employee_id, source_namespace,
          source_observation_id, occurred_at
        )
        values (
          v_observation_id, v_segment.house_id, v_segment.employee_id,
          'KIOSK_SCAN_V1', btrim(v_in_event.metadata ->> 'clientId'),
          v_in_event.occurred_at
        );

        insert into public.hr_attendance_evidence (
          id, house_id, employee_id, observation_id,
          lane, evidence_kind, branch_id,
          integrity_state, integrity_reason_class, sufficiency_state,
          is_integrity_eligible, semantic_revision,
          supersedes_evidence_id, lineage_root_evidence_id,
          source_reference
        )
        values (
          v_evidence_id, v_segment.house_id, v_segment.employee_id, v_observation_id,
          'KIOSK', 'LOGICAL_IN', v_in_event.branch_id,
          'ESTABLISHED', 'VALID', 'SUFFICIENT',
          true, 1, null, v_evidence_id,
          v_in_event.device_id::text
        );

        insert into public.hr_attendance_fact_evidence (
          house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
        )
        values (
          v_segment.house_id, v_fact_id, v_next_basis,
          v_evidence_id, v_segment.employee_id
        );

        if v_segment.time_out is not null then
          v_observation_id := gen_random_uuid();
          v_evidence_id := gen_random_uuid();

          insert into public.hr_attendance_observations (
            id, house_id, employee_id, source_namespace,
            source_observation_id, occurred_at
          )
          values (
            v_observation_id, v_segment.house_id, v_segment.employee_id,
            'KIOSK_SCAN_V1', btrim(v_out_event.metadata ->> 'clientId'),
            v_out_event.occurred_at
          );

          insert into public.hr_attendance_evidence (
            id, house_id, employee_id, observation_id,
            lane, evidence_kind, branch_id,
            integrity_state, integrity_reason_class, sufficiency_state,
            is_integrity_eligible, semantic_revision,
            supersedes_evidence_id, lineage_root_evidence_id,
            source_reference
          )
          values (
            v_evidence_id, v_segment.house_id, v_segment.employee_id, v_observation_id,
            'KIOSK', 'LOGICAL_OUT', v_out_event.branch_id,
            'ESTABLISHED', 'VALID', 'SUFFICIENT',
            true, 1, null, v_evidence_id,
            v_out_event.device_id::text
          );

          insert into public.hr_attendance_fact_evidence (
            house_id, fact_id, evidence_basis_revision, evidence_id, employee_id
          )
          values (
            v_segment.house_id, v_fact_id, v_next_basis,
            v_evidence_id, v_segment.employee_id
          );
        end if;

        update public.hr_attendance_evidence_frames
        set is_sealed = true,
            sealed_at = now()
        where house_id = v_segment.house_id
          and fact_id = v_fact_id
          and employee_id = v_segment.employee_id
          and evidence_basis_revision = v_next_basis;

        update public.hr_attendance_facts
        set evidence_basis_revision = v_next_basis,
            updated_at = now()
        where house_id = v_segment.house_id
          and id = v_fact_id
          and employee_id = v_segment.employee_id;
      end if;
    end if;

    perform public.hr_attendance_bump_employee_generation(
      v_segment.house_id,
      v_segment.employee_id
    );
  end loop;

  if exists (
    select 1 from public.dtr_segments where canonical_fact_id is null
  ) then
    raise exception 'Gate-B cutover requires every compatibility row to have canonical_fact_id'
      using errcode = '55000';
  end if;

  -- Persist final authority pairs after bootstrap/evidence upgrades.
  perform public.hr_rebuild_attendance_authorization_projection(house.id)
  from public.houses house
  where exists (
    select 1
    from public.dtr_segments segment
    where segment.house_id = house.id
  );
end
$block$;

-- Remove all legacy authenticated write policies. SELECT compatibility remains until
-- later consumer/read-security gates.
drop policy if exists dtr_segments_insert_authenticated on public.dtr_segments;
drop policy if exists dtr_segments_update_authenticated on public.dtr_segments;
drop policy if exists dtr_segments_delete_authenticated on public.dtr_segments;
drop policy if exists dtr_segments_insert_house_roles on public.dtr_segments;
drop policy if exists dtr_segments_update_house_roles on public.dtr_segments;
drop policy if exists dtr_segments_delete_house_roles on public.dtr_segments;

-- Raw attendance mutation is no longer an application capability. RLS cannot contain
-- service_role, so remove table-level mutation privileges for both application roles.
revoke insert, update, delete, truncate, references, trigger
  on table public.dtr_segments from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.dtr_segments from service_role;

-- Fail the migration if a normal application role still has a raw mutation privilege.
do $verify$
begin
  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name = 'dtr_segments'
      and grant_row.grantee in ('authenticated', 'service_role')
      and grant_row.privilege_type in (
        'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      )
  ) then
    raise exception 'Gate-B cutover left a raw dtr_segments mutation privilege'
      using errcode = '55000';
  end if;
end
$verify$;

notify pgrst, 'reload schema';
commit;
