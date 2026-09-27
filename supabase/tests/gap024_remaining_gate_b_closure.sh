#!/usr/bin/env bash
set -euo pipefail

PHASE="${1:-}"
DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  echo "::error::Local Supabase database container was not found"
  exit 1
fi

psql_super() {
  docker exec -i "$DB_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

scalar() {
  docker exec -i "$DB_CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$1"
}

fail() {
  echo "::error::$*"
  exit 1
}

assert_scalar() {
  local expected="$1"
  local query="$2"
  local label="$3"
  local actual
  actual="$(scalar "$query")"
  if [[ "$actual" != "$expected" ]]; then
    fail "$label (expected=$expected actual=$actual)"
  fi
  echo "PASS: $label"
}

GB_HOUSE="10000000-0000-0000-0000-000000000001"
GB_BRANCH="20000000-0000-0000-0000-000000000001"
GB_AUTH_USER="30000000-0000-0000-0000-000000000001"
GB_DEVICE="60000000-0000-0000-0000-000000000001"
POST_MANUAL_EMP="82000000-0000-0000-0000-0000000000e1"
POST_KIOSK_EMP="82000000-0000-0000-0000-0000000000e2"
POST_BULK_EMP="82000000-0000-0000-0000-0000000000e3"

auth_sql() {
  local body="$1"
  psql_super <<SQL
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"$GB_AUTH_USER","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
$body
COMMIT;
SQL
}

service_sql() {
  local body="$1"
  psql_super <<SQL
BEGIN;
SET LOCAL ROLE service_role;
$body
COMMIT;
SQL
}

expect_auth_failure() {
  local sql="$1"
  local label="$2"
  local log
  log="$(mktemp)"
  set +e
  auth_sql "$sql" >"$log" 2>&1
  local rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    cat "$log"
    rm -f "$log"
    fail "$label unexpectedly succeeded"
  fi
  rm -f "$log"
  echo "PASS: $label"
}

expect_role_failure() {
  local role="$1"
  local sql="$2"
  local label="$3"
  local log
  log="$(mktemp)"
  set +e
  psql_super >"$log" 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE $role;
$sql
COMMIT;
SQL
  local rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    cat "$log"
    rm -f "$log"
    fail "$label unexpectedly succeeded"
  fi
  rm -f "$log"
  echo "PASS: $label"
}

HOUSE="81000000-0000-0000-0000-000000000001"
BRANCH="81000000-0000-0000-0000-0000000000a1"
DEVICE="81000000-0000-0000-0000-0000000000d1"
EMP_MANUAL="81000000-0000-0000-0000-0000000000e1"
EMP_PROVED="81000000-0000-0000-0000-0000000000e2"
EMP_UNPROVED="81000000-0000-0000-0000-0000000000e3"
SEG_MANUAL="81000000-0000-0000-0000-000000000011"
SEG_PROVED="81000000-0000-0000-0000-000000000012"
SEG_UNPROVED="81000000-0000-0000-0000-000000000013"

case "$PHASE" in
  prepare-live-kiosk-prereqs)
    psql_super <<'SQL'
alter table public.hr_kiosk_devices
  add column if not exists last_event_at timestamptz;

alter table public.hr_kiosk_devices enable row level security;
alter table public.hr_kiosk_events enable row level security;

grant select, insert, update, delete, truncate, references, trigger
  on public.hr_kiosk_devices to authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger
  on public.hr_kiosk_events to authenticated, service_role;

drop policy if exists hr_kiosk_devices_select_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_select_house_roles
  on public.hr_kiosk_devices
  for select
  to authenticated
  using (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_devices_insert_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_insert_house_roles
  on public.hr_kiosk_devices
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_devices_update_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_update_house_roles
  on public.hr_kiosk_devices
  for update
  to authenticated
  using (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_devices_delete_house_roles on public.hr_kiosk_devices;
create policy hr_kiosk_devices_delete_house_roles
  on public.hr_kiosk_devices
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_devices.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_select_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_select_house_roles
  on public.hr_kiosk_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_insert_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_insert_house_roles
  on public.hr_kiosk_events
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_update_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_update_house_roles
  on public.hr_kiosk_events
  for update
  to authenticated
  using (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

drop policy if exists hr_kiosk_events_delete_house_roles on public.hr_kiosk_events;
create policy hr_kiosk_events_delete_house_roles
  on public.hr_kiosk_events
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.house_roles hr
      where hr.house_id = hr_kiosk_events.house_id
        and hr.role in ('house_owner', 'house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );
SQL
    echo "PASS: test prerequisite mirrors current kiosk grant/policy posture"
    ;;

  seed-pre-cutover)
    psql_super <<SQL
insert into public.houses (id, slug, name, house_type)
values ('$HOUSE', 'remaining-gate-b-fixture', 'Remaining Gate B Fixture', 'RETAIL');

insert into public.branches (id, house_id, name, slug)
values ('$BRANCH', '$HOUSE', 'Fixture Branch', 'fixture-branch');

insert into public.employees (id, code, full_name, rate_per_day, status, branch_id, house_id)
values
  ('$EMP_MANUAL', 'RGB-MANUAL', 'Remaining Gate B Manual', 0, 'active', '$BRANCH', '$HOUSE'),
  ('$EMP_PROVED', 'RGB-PROVED', 'Remaining Gate B Proven Kiosk', 0, 'active', '$BRANCH', '$HOUSE'),
  ('$EMP_UNPROVED', 'RGB-UNPROVED', 'Remaining Gate B Unproved Kiosk', 0, 'active', '$BRANCH', '$HOUSE');

insert into public.hr_kiosk_devices (id, house_id, branch_id, name, token_hash, is_active)
values ('$DEVICE', '$HOUSE', '$BRANCH', 'Remaining Gate B Device', 'remaining-gate-b-token-hash', true);

insert into public.dtr_segments (
  id, house_id, employee_id, work_date, time_in, time_out,
  hours_worked, overtime_minutes, source, status
)
values
  ('$SEG_MANUAL', '$HOUSE', '$EMP_MANUAL', '2026-09-20',
    '2026-09-20 08:00+08', '2026-09-20 17:00+08', 8, 0, 'manual', 'closed'),
  ('$SEG_PROVED', '$HOUSE', '$EMP_PROVED', '2026-09-21',
    '2026-09-21 08:00+08', '2026-09-21 17:00+08', 8, 0, 'system', 'closed'),
  ('$SEG_UNPROVED', '$HOUSE', '$EMP_UNPROVED', '2026-09-22',
    '2026-09-22 08:00+08', null, 0, 0, 'system', 'open');

insert into public.hr_kiosk_events (
  house_id, branch_id, device_id, employee_id, event_type, occurred_at, metadata
)
values
  ('$HOUSE', '$BRANCH', '$DEVICE', '$EMP_PROVED', 'clock_in',
    '2026-09-21 08:00+08',
    jsonb_build_object('segmentId', '$SEG_PROVED', 'clientId', 'rgb-proved-in')),
  ('$HOUSE', '$BRANCH', '$DEVICE', '$EMP_PROVED', 'clock_out',
    '2026-09-21 17:00+08',
    jsonb_build_object('segmentId', '$SEG_PROVED', 'clientId', 'rgb-proved-out')),
  ('$HOUSE', '$BRANCH', '$DEVICE', '$EMP_UNPROVED', 'clock_in',
    '2026-09-22 08:00+08',
    jsonb_build_object('segmentId', '$SEG_UNPROVED'));
SQL
    echo "PASS: seeded isolated pre-cutover legacy fixture"
    ;;

  verify-reconcile)
    assert_scalar "0" "select count(*) from public.dtr_segments where id in ('$SEG_MANUAL','$SEG_PROVED','$SEG_UNPROVED') and canonical_fact_id is null;" "legacy fixture fully bridged"
    assert_scalar "UNATTRIBUTED|" "select p.attribution_state || '|' || coalesce(p.active_branch_id::text,'') from public.dtr_segments s join public.hr_attendance_authorization_projection p on p.house_id=s.house_id and p.fact_id=s.canonical_fact_id where s.id='$SEG_MANUAL';" "manual legacy fixture stays unattributed"
    assert_scalar "ATTRIBUTED|$BRANCH" "select p.attribution_state || '|' || coalesce(p.active_branch_id::text,'') from public.dtr_segments s join public.hr_attendance_authorization_projection p on p.house_id=s.house_id and p.fact_id=s.canonical_fact_id where s.id='$SEG_PROVED';" "fully proven kiosk fixture becomes attributed"
    assert_scalar "UNATTRIBUTED|" "select p.attribution_state || '|' || coalesce(p.active_branch_id::text,'') from public.dtr_segments s join public.hr_attendance_authorization_projection p on p.house_id=s.house_id and p.fact_id=s.canonical_fact_id where s.id='$SEG_UNPROVED';" "insufficient kiosk fixture fails closed"
    ;;

  restore-released-seams)
    psql_super <<'SQL'
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

revoke all on function public.hr_attendance_p1_hr4_decision(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
SQL
    assert_scalar "UNAVAILABLE" "select public.hr_attendance_p1_hr4_decision('$HOUSE','CORRECTION',gen_random_uuid(),'fixture')->>'status';" "released HR-4 seam restored"
    ;;

  verify-post-p1)
    echo "Verifying post-cutover producer compatibility on the current business date"
    psql_super <<SQL
insert into public.employees (id, code, full_name, rate_per_day, status, branch_id, house_id)
values
  ('$POST_MANUAL_EMP', 'RGB-POST-MANUAL', 'Remaining B Post Manual', 0, 'active', '$GB_BRANCH', '$GB_HOUSE'),
  ('$POST_KIOSK_EMP', 'RGB-POST-KIOSK', 'Remaining B Post Kiosk', 0, 'active', '$GB_BRANCH', '$GB_HOUSE'),
  ('$POST_BULK_EMP', 'RGB-POST-BULK', 'Remaining B Post Bulk', 0, 'active', '$GB_BRANCH', '$GB_HOUSE')
on conflict (id) do nothing;
SQL

    auth_sql "select public.hr_create_manual_attendance(
      '$GB_HOUSE',
      '$POST_MANUAL_EMP',
      '$GB_BRANCH',
      'rgb-post-manual',
      (now() at time zone 'Asia/Manila')::date,
      (((now() at time zone 'Asia/Manila')::date + time '08:00') at time zone 'Asia/Manila'),
      null
    );"

    service_sql "select public.hr_apply_kiosk_attendance_scan(
      '$GB_HOUSE',
      '$GB_BRANCH',
      '$GB_DEVICE',
      '$POST_KIOSK_EMP',
      'rgb-post-kiosk',
      now()
    );"

    auth_sql "select public.hr_replace_bulk_attendance_day(
      '$GB_HOUSE',
      '$POST_BULK_EMP',
      (now() at time zone 'Asia/Manila')::date,
      'rgb-post-bulk',
      jsonb_build_array(
        jsonb_build_object(
          'timeIn', ((((now() at time zone 'Asia/Manila')::date + time '09:00') at time zone 'Asia/Manila'))::text,
          'timeOut', ((((now() at time zone 'Asia/Manila')::date + time '12:00') at time zone 'Asia/Manila'))::text
        )
      )
    );"

    assert_scalar "3" "select count(*) from public.hr_attendance_facts where employee_id in ('$POST_MANUAL_EMP','$POST_KIOSK_EMP','$POST_BULK_EMP') and is_active;" "manual, kiosk, and bulk producers remain canonical after cutover"
    assert_scalar "0" "select count(*) from public.hr_attendance_facts f left join public.hr_attendance_authorization_projection p on p.house_id=f.house_id and p.fact_id=f.id and p.employee_id=f.employee_id where f.employee_id in ('$POST_MANUAL_EMP','$POST_KIOSK_EMP','$POST_BULK_EMP') and f.is_active and p.fact_id is null;" "post-cutover producers immediately maintain projection"

    echo "Verifying authenticated device administration and event read survive cutover"
    auth_sql "insert into public.hr_kiosk_devices(
      id, house_id, branch_id, name, token_hash, is_active
    ) values (
      '82000000-0000-0000-0000-0000000000d1',
      '$GB_HOUSE',
      '$GB_BRANCH',
      'Remaining B Auth Device',
      'remaining-b-auth-device-hash',
      true
    );
    update public.hr_kiosk_devices
    set name='Remaining B Auth Device Updated'
    where id='82000000-0000-0000-0000-0000000000d1';
    select count(*) from public.hr_kiosk_events where house_id='$GB_HOUSE';
    delete from public.hr_kiosk_devices
    where id='82000000-0000-0000-0000-0000000000d1';"

    expect_auth_failure "insert into public.hr_kiosk_events(
      house_id, branch_id, device_id, event_type, occurred_at, metadata
    ) values (
      '$GB_HOUSE', '$GB_BRANCH', '$GB_DEVICE', 'sync_fail', now(), '{}'::jsonb
    );" "authenticated raw kiosk-event insert denied with valid owner context"

    echo "Verifying full canonical bridge and projection coverage"
    assert_scalar "0" "select count(*) from public.dtr_segments where canonical_fact_id is null;" "no unbridged compatibility rows"
    assert_scalar "0" "select count(*) from public.hr_attendance_facts f left join public.hr_attendance_authorization_projection p on p.house_id=f.house_id and p.fact_id=f.id and p.employee_id=f.employee_id where f.is_active and p.fact_id is null;" "no active fact missing projection"

    echo "Verifying semantic projection rebuild determinism"
    psql_super <<'SQL'
begin;
create temp table rgb_projection_before on commit drop as
select house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
       evidence_basis_fingerprint, attribution_state, active_branch_id,
       governing_evidence_ids
from public.hr_attendance_authorization_projection;

create temp table rgb_history_count on commit drop as
select count(*)::bigint as value from public.hr_attendance_authorization_history;

select public.hr_rebuild_attendance_authorization_projection(h.id)
from public.houses h
where exists (
  select 1 from public.hr_attendance_facts f
  where f.house_id = h.id and f.is_active
);

do $verify$
begin
  if exists (
    (select * from rgb_projection_before
     except
     select house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
            evidence_basis_fingerprint, attribution_state, active_branch_id,
            governing_evidence_ids
     from public.hr_attendance_authorization_projection)
    union all
    (select house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
            evidence_basis_fingerprint, attribution_state, active_branch_id,
            governing_evidence_ids
     from public.hr_attendance_authorization_projection
     except
     select * from rgb_projection_before)
  ) then
    raise exception 'Remaining Gate-B semantic projection changed after deterministic rebuild';
  end if;

  if (select value from rgb_history_count) <>
     (select count(*) from public.hr_attendance_authorization_history) then
    raise exception 'Remaining Gate-B rebuild appended duplicate authorization history';
  end if;
end
$verify$;

select public.hr_rebuild_attendance_authorization_projection(h.id)
from public.houses h
where exists (
  select 1 from public.hr_attendance_facts f
  where f.house_id = h.id and f.is_active
);

do $verify$
begin
  if exists (
    (select * from rgb_projection_before
     except
     select house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
            evidence_basis_fingerprint, attribution_state, active_branch_id,
            governing_evidence_ids
     from public.hr_attendance_authorization_projection)
    union all
    (select house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
            evidence_basis_fingerprint, attribution_state, active_branch_id,
            governing_evidence_ids
     from public.hr_attendance_authorization_projection
     except
     select * from rgb_projection_before)
  ) then
    raise exception 'Remaining Gate-B semantic projection changed after second rebuild';
  end if;

  if (select value from rgb_history_count) <>
     (select count(*) from public.hr_attendance_authorization_history) then
    raise exception 'Remaining Gate-B second rebuild appended duplicate authorization history';
  end if;
end
$verify$;
commit;
SQL
    echo "PASS: semantic projection/history replay is deterministic"

    echo "Verifying discovery-based canonical privilege posture"
    assert_scalar "0" "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values ('authenticated'),('service_role')) role_name(name) where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'hr_attendance_%' and (has_table_privilege(role_name.name,c.oid,'SELECT') or has_table_privilege(role_name.name,c.oid,'INSERT') or has_table_privilege(role_name.name,c.oid,'UPDATE') or has_table_privilege(role_name.name,c.oid,'DELETE') or has_table_privilege(role_name.name,c.oid,'TRUNCATE') or has_table_privilege(role_name.name,c.oid,'REFERENCES') or has_table_privilege(role_name.name,c.oid,'TRIGGER'));" "canonical attendance tables deny direct application-role privileges"

    assert_scalar "0" "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'hr_%attendance%' or p.proname like 'hr_%kiosk%') and has_function_privilege('service_role',p.oid,'EXECUTE') and p.proname not in ('hr_apply_kiosk_attendance_scan','hr_record_kiosk_support_event','hr_touch_kiosk_device_telemetry','hr_read_canonical_attendance_branch_scoped','hr_read_canonical_attendance_house_global');" "service-role attendance/kiosk callable surface has no unreviewed function"

    for allowed in hr_apply_kiosk_attendance_scan hr_record_kiosk_support_event hr_touch_kiosk_device_telemetry hr_read_canonical_attendance_branch_scoped hr_read_canonical_attendance_house_global; do
      assert_scalar "1" "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='$allowed' and has_function_privilege('service_role',p.oid,'EXECUTE');" "service-role approved function $allowed has exactly one callable overload"
    done

    assert_scalar "0" "select has_function_privilege('service_role','public.hr_rebuild_attendance_authorization_projection(uuid)','EXECUTE')::int;" "projection rebuild is private from service_role"
    assert_scalar "1" "select (has_table_privilege('authenticated','public.hr_kiosk_events','SELECT') and not has_table_privilege('authenticated','public.hr_kiosk_events','INSERT') and not has_table_privilege('authenticated','public.hr_kiosk_events','UPDATE') and not has_table_privilege('authenticated','public.hr_kiosk_events','DELETE'))::int;" "authenticated kiosk-event access is read-only"
    assert_scalar "1" "select (not has_table_privilege('service_role','public.hr_kiosk_events','SELECT') and not has_table_privilege('service_role','public.hr_kiosk_events','INSERT') and not has_table_privilege('service_role','public.hr_kiosk_events','UPDATE') and not has_table_privilege('service_role','public.hr_kiosk_events','DELETE'))::int;" "service_role has no raw kiosk-event access"
    assert_scalar "1" "select (has_table_privilege('service_role','public.hr_kiosk_devices','SELECT') and not has_table_privilege('service_role','public.hr_kiosk_devices','INSERT') and not has_table_privilege('service_role','public.hr_kiosk_devices','UPDATE') and not has_table_privilege('service_role','public.hr_kiosk_devices','DELETE') and not has_table_privilege('service_role','public.hr_kiosk_devices','TRUNCATE') and not has_table_privilege('service_role','public.hr_kiosk_devices','REFERENCES') and not has_table_privilege('service_role','public.hr_kiosk_devices','TRIGGER'))::int;" "service_role kiosk-device access is SELECT-only"

    echo "Verifying support wrappers preserve bounded behavior"
    psql_super <<SQL
begin;
set local role service_role;
select public.hr_touch_kiosk_device_telemetry('$DEVICE');
select public.hr_record_kiosk_support_event(
  '$DEVICE',
  '$EMP_PROVED',
  'sync_success',
  '2026-09-23 09:15+08',
  '{"clientEventId":"rgb-support"}'::jsonb
);
commit;
SQL
    assert_scalar "1" "select (last_seen_at is not null)::int from public.hr_kiosk_devices where id='$DEVICE';" "telemetry wrapper updates last_seen_at"
    assert_scalar "2026-09-23 01:15:00+00" "select last_event_at::text from public.hr_kiosk_devices where id='$DEVICE';" "support event updates last_event_at to occurred_at"
    assert_scalar "1" "select count(*) from public.hr_kiosk_events where device_id='$DEVICE' and event_type='sync_success' and metadata->>'clientEventId'='rgb-support';" "allowed support event persists once"

    for forbidden in scan clock_in clock_out queued; do
      expect_role_failure service_role "select public.hr_record_kiosk_support_event('$DEVICE','$EMP_PROVED','$forbidden','2026-09-23 09:20+08','{}'::jsonb);" "support wrapper rejects $forbidden"
    done

    expect_role_failure service_role "insert into public.hr_kiosk_events(house_id,branch_id,device_id,event_type,occurred_at,metadata) values('$HOUSE','$BRANCH','$DEVICE','sync_fail',now(),'{}');" "service_role raw kiosk-event insert denied"
    expect_role_failure service_role "update public.hr_kiosk_devices set last_seen_at=now() where id='$DEVICE';" "service_role raw kiosk-device update denied"

    echo "Remaining Gate-B cross-slice closure verifier: PASS"
    ;;

  *)
    echo "Usage: $0 {prepare-live-kiosk-prereqs|seed-pre-cutover|verify-reconcile|restore-released-seams|verify-post-p1}" >&2
    exit 2
    ;;
esac
