#!/usr/bin/env bash
set -euo pipefail

HOUSE="10000000-0000-0000-0000-000000000001"
BRANCH_A="20000000-0000-0000-0000-000000000001"
BRANCH_B="20000000-0000-0000-0000-000000000002"
AUTH_USER="30000000-0000-0000-0000-000000000001"
ENTITY="40000000-0000-0000-0000-000000000001"
DEVICE="60000000-0000-0000-0000-000000000001"

EMP1="50000000-0000-0000-0000-000000000001"
EMP2="50000000-0000-0000-0000-000000000002"
EMP3="50000000-0000-0000-0000-000000000003"
EMP4="50000000-0000-0000-0000-000000000004"
EMP5="50000000-0000-0000-0000-000000000005"
EMP6="50000000-0000-0000-0000-000000000006"
EMP7="50000000-0000-0000-0000-000000000007"
EMP8="50000000-0000-0000-0000-000000000008"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  echo "::error::Local Supabase database container was not found"
  exit 1
fi

echo "Using disposable database container: $DB_CONTAINER"

psql_super() {
  docker exec -i "$DB_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

scalar() {
  docker exec -i "$DB_CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$1"
}

auth_sql() {
  local body="$1"
  psql_super <<SQL
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"$AUTH_USER","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '10s';
$body
COMMIT;
SQL
}

service_sql() {
  local body="$1"
  psql_super <<SQL
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '10s';
$body
COMMIT;
SQL
}

super_sql() {
  local body="$1"
  psql_super <<SQL
BEGIN;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '10s';
$body
COMMIT;
SQL
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

expect_fail_auth() {
  local sql="$1"
  local label="$2"
  set +e
  auth_sql "$sql" >"$TMP_DIR/expected-fail.log" 2>&1
  local rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    cat "$TMP_DIR/expected-fail.log"
    fail "$label unexpectedly succeeded"
  fi
  echo "PASS: $label"
}

expect_fail_service() {
  local sql="$1"
  local label="$2"
  set +e
  service_sql "$sql" >"$TMP_DIR/expected-fail.log" 2>&1
  local rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    cat "$TMP_DIR/expected-fail.log"
    fail "$label unexpectedly succeeded"
  fi
  echo "PASS: $label"
}

wait_pair_success() {
  local pid_a="$1"
  local pid_b="$2"
  local log_a="$3"
  local log_b="$4"
  local label="$5"
  set +e
  wait "$pid_a"; local rc_a=$?
  wait "$pid_b"; local rc_b=$?
  set -e
  if [[ $rc_a -ne 0 || $rc_b -ne 0 ]]; then
    echo "--- session A ---"; cat "$log_a" || true
    echo "--- session B ---"; cat "$log_b" || true
    fail "$label failed (A=$rc_a B=$rc_b)"
  fi
  echo "PASS: $label"
}

echo "Seeding isolated Gate-B fixtures"
psql_super <<SQL
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values (
  '$AUTH_USER', 'authenticated', 'authenticated',
  'gate-b-ci@example.invalid', '', now(), now(), now()
)
on conflict (id) do nothing;

insert into public.entities (id, kind, display_name, universal_code, is_gm)
values ('$ENTITY', 'PERSON', 'Gate B CI Owner', 'GATE-B-CI-OWNER', false)
on conflict (id) do nothing;

insert into public.accounts (user_id, entity_id)
values ('$AUTH_USER', '$ENTITY')
on conflict (user_id) do update set entity_id = excluded.entity_id;

insert into public.houses (id, slug, name, house_type)
values ('$HOUSE', 'gate-b-ci-house', 'Gate B CI House', 'RETAIL')
on conflict (id) do nothing;

insert into public.branches (id, house_id, name, slug)
values
  ('$BRANCH_A', '$HOUSE', 'CI Branch A', 'ci-branch-a'),
  ('$BRANCH_B', '$HOUSE', 'CI Branch B', 'ci-branch-b')
on conflict (id) do nothing;

insert into public.house_roles (house_id, entity_id, role)
values ('$HOUSE', '$ENTITY', 'house_owner')
on conflict do nothing;

insert into public.employees (id, code, full_name, rate_per_day, status, branch_id, house_id)
values
  ('$EMP1', 'CI-E01', 'CI Employee 01', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP2', 'CI-E02', 'CI Employee 02', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP3', 'CI-E03', 'CI Employee 03', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP4', 'CI-E04', 'CI Employee 04', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP5', 'CI-E05', 'CI Employee 05', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP6', 'CI-E06', 'CI Employee 06', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP7', 'CI-E07', 'CI Employee 07', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP8', 'CI-E08', 'CI Employee 08', 0, 'active', '$BRANCH_A', '$HOUSE')
on conflict (id) do nothing;

insert into public.hr_kiosk_devices (
  id, house_id, branch_id, name, token_hash, is_active
)
values (
  '$DEVICE', '$HOUSE', '$BRANCH_A',
  'Gate B CI Kiosk', 'gate-b-ci-token-hash', true
)
on conflict (id) do update
set house_id = excluded.house_id,
    branch_id = excluded.branch_id,
    is_active = true;
SQL

echo "C1 — duplicate manual create + operation replay"
auth_sql "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','c1-a','2026-09-24',
  '2026-09-24 08:00:00+08','2026-09-24 17:00:00+08'
);" >"$TMP_DIR/c1-a.log" 2>&1 &
p1=$!
auth_sql "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','c1-b','2026-09-24',
  '2026-09-24 08:00:00+08','2026-09-24 17:00:00+08'
);" >"$TMP_DIR/c1-b.log" 2>&1 &
p2=$!
wait_pair_success "$p1" "$p2" "$TMP_DIR/c1-a.log" "$TMP_DIR/c1-b.log" "C1 concurrent manual creates"
assert_scalar "2" "select count(*) from public.dtr_segments where employee_id='$EMP1';" "C1 both facts are compatibility-backed"

auth_sql "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','c1-replay','2026-09-25',
  '2026-09-25 08:00:00+08','2026-09-25 17:00:00+08'
);"
auth_sql "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','c1-replay','2026-09-25',
  '2026-09-25 08:00:00+08','2026-09-25 17:00:00+08'
);"
assert_scalar "1" "select count(*) from public.hr_attendance_mutation_operations where house_id='$HOUSE' and producer_namespace='MANUAL_ADMIN_V1' and operation_id='c1-replay';" "C1 replay keeps one operation row"
expect_fail_auth "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','c1-replay','2026-09-25',
  '2026-09-25 09:00:00+08','2026-09-25 17:00:00+08'
);" "C1 same operation ID with different input fails"

echo "C2 — exact kiosk retry and distinct debounced scan"
service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP2','c2-k1',
  '2026-09-24 08:00:00+08'
);" >"$TMP_DIR/c2-a.log" 2>&1 &
p1=$!
service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP2','c2-k1',
  '2026-09-24 08:00:00+08'
);" >"$TMP_DIR/c2-b.log" 2>&1 &
p2=$!
wait_pair_success "$p1" "$p2" "$TMP_DIR/c2-a.log" "$TMP_DIR/c2-b.log" "C2 exact concurrent kiosk retry"
assert_scalar "1" "select count(*) from public.hr_kiosk_events where employee_id='$EMP2' and event_type='clock_in' and metadata->>'clientId'='c2-k1';" "C2 exact retry creates one clock-in"

service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP2','c2-k2',
  '2026-09-24 08:00:05+08'
);" >"$TMP_DIR/c2-debounce.log" 2>&1
grep -qi "debounced" "$TMP_DIR/c2-debounce.log" || fail "C2 distinct scan inside debounce window was not debounced"
assert_scalar "0" "select count(*) from public.hr_kiosk_events where employee_id='$EMP2' and event_type='clock_out';" "C2 debounce prevents accidental immediate clock-out"

echo "C3 — kiosk close vs stale admin repair"
service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP3','c3-open',
  '2026-09-24 08:00:00+08'
);"
SEG3="$(scalar "select id from public.dtr_segments where employee_id='$EMP3' and status='open' order by created_at desc limit 1;")"
[[ -n "$SEG3" ]] || fail "C3 failed to create open kiosk segment"

psql_super <<SQL >"$TMP_DIR/c3-kiosk.log" 2>&1 &
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '10s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'gap024.attendance_mutation:$HOUSE:$EMP3', 0
  )
);
select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP3','c3-close',
  '2026-09-24 08:00:20+08'
);
select pg_sleep(1);
COMMIT;
SQL
p1=$!
sleep 0.2
super_sql "select public.hr_apply_attendance_time_repair(
  '$HOUSE','$SEG3','c3-repair','CI stale repair',
  '2026-09-24 08:00:00+08','2026-09-24 08:30:00+08',1
);" >"$TMP_DIR/c3-repair.log" 2>&1 &
p2=$!

set +e
wait "$p1"; rc1=$?
wait "$p2"; rc2=$?
set -e
[[ $rc1 -eq 0 ]] || { cat "$TMP_DIR/c3-kiosk.log"; fail "C3 kiosk close failed"; }
[[ $rc2 -ne 0 ]] || { cat "$TMP_DIR/c3-repair.log"; fail "C3 stale repair unexpectedly succeeded"; }
grep -qi "stale" "$TMP_DIR/c3-repair.log" || { cat "$TMP_DIR/c3-repair.log"; fail "C3 repair failed for an unexpected reason"; }
echo "PASS: C3 serialized close wins and stale repair fails without deadlock"

echo "C4 — bulk replacement vs late kiosk scan"
auth_sql "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP4','$BRANCH_A','c4-seed','2026-09-24',
  '2026-09-24 08:00:00+08','2026-09-24 10:00:00+08'
);"
OLD_FACT4="$(scalar "select canonical_fact_id from public.dtr_segments where employee_id='$EMP4' limit 1;")"

psql_super <<SQL >"$TMP_DIR/c4-bulk.log" 2>&1 &
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"$AUTH_USER","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '10s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'gap024.attendance_mutation:$HOUSE:$EMP4', 0
  )
);
select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP4','2026-09-24','c4-bulk',
  '[{"timeIn":"2026-09-24T08:30:00+08:00","timeOut":"2026-09-24T11:30:00+08:00"}]'::jsonb
);
select pg_sleep(1);
COMMIT;
SQL
p1=$!
sleep 0.2
service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP4','c4-kiosk',
  '2026-09-24 18:00:00+08'
);" >"$TMP_DIR/c4-kiosk.log" 2>&1 &
p2=$!
wait_pair_success "$p1" "$p2" "$TMP_DIR/c4-bulk.log" "$TMP_DIR/c4-kiosk.log" "C4 bulk replace and late kiosk serialize"
assert_scalar "false" "select is_active::text from public.hr_attendance_facts where id='$OLD_FACT4';" "C4 predecessor fact stays retired"
assert_scalar "0" "select count(*) from public.hr_attendance_fact_revisions where employee_id='$EMP4' and dtr_segment_id is not null;" "C4 no revision references deletable compatibility rows"
assert_scalar "0" "select count(*) from public.hr_attendance_facts f left join public.dtr_segments s on s.house_id=f.house_id and s.employee_id=f.employee_id and s.canonical_fact_id=f.id where f.employee_id='$EMP4' and f.is_active and s.id is null;" "C4 active facts remain compatibility-backed"

echo "C5 — two generation-changing mutations for one employee"
GEN5_BEFORE="$(scalar "select coalesce((select candidate_evidence_generation from public.hr_attendance_employee_generations where house_id='$HOUSE' and employee_id='$EMP5'),0);")"
auth_sql "select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP5','2026-09-20','c5-a',
  '[{"timeIn":"2026-09-20T08:00:00+08:00","timeOut":"2026-09-20T17:00:00+08:00"}]'::jsonb
);" >"$TMP_DIR/c5-a.log" 2>&1 &
p1=$!
auth_sql "select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP5','2026-09-21','c5-b',
  '[{"timeIn":"2026-09-21T08:00:00+08:00","timeOut":"2026-09-21T17:00:00+08:00"}]'::jsonb
);" >"$TMP_DIR/c5-b.log" 2>&1 &
p2=$!
wait_pair_success "$p1" "$p2" "$TMP_DIR/c5-a.log" "$TMP_DIR/c5-b.log" "C5 concurrent generation-changing mutations"
GEN5_AFTER="$(scalar "select candidate_evidence_generation from public.hr_attendance_employee_generations where house_id='$HOUSE' and employee_id='$EMP5';")"
[[ "$GEN5_AFTER" -eq $((GEN5_BEFORE + 2)) ]] || fail "C5 lost or duplicated generation increment (before=$GEN5_BEFORE after=$GEN5_AFTER)"
echo "PASS: C5 employee generation advances monotonically without a lost increment"

echo "C6 — overlapping bulk result races"
auth_sql "select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP6','2026-09-22','c6-a',
  '[{"timeIn":"2026-09-22T08:00:00+08:00","timeOut":"2026-09-22T17:00:00+08:00"}]'::jsonb
);" >"$TMP_DIR/c6-a.log" 2>&1 &
p1=$!
auth_sql "select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP6','2026-09-22','c6-b',
  '[{"timeIn":"2026-09-22T08:30:00+08:00","timeOut":"2026-09-22T17:30:00+08:00"}]'::jsonb
);" >"$TMP_DIR/c6-b.log" 2>&1 &
p2=$!
wait_pair_success "$p1" "$p2" "$TMP_DIR/c6-a.log" "$TMP_DIR/c6-b.log" "C6 overlapping bulk results serialize without deadlock"
expect_fail_auth "select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP6','2026-09-22','c6-a',
  '[{"timeIn":"2026-09-22T09:00:00+08:00","timeOut":"2026-09-22T18:00:00+08:00"}]'::jsonb
);" "C6 same bulk operation ID with different input fails"

echo "C7 — projection rebuild vs active mutation"
auth_sql "select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP7','2026-09-23','c7-bulk',
  '[{"timeIn":"2026-09-23T08:00:00+08:00","timeOut":"2026-09-23T17:00:00+08:00"}]'::jsonb
);" >"$TMP_DIR/c7-mutation.log" 2>&1 &
p1=$!
super_sql "select public.hr_rebuild_attendance_authorization_projection('$HOUSE');" >"$TMP_DIR/c7-rebuild.log" 2>&1 &
p2=$!
wait_pair_success "$p1" "$p2" "$TMP_DIR/c7-mutation.log" "$TMP_DIR/c7-rebuild.log" "C7 rebuild and mutation complete without partial state"

super_sql "select public.hr_rebuild_attendance_authorization_projection('$HOUSE');"
HASH7_A="$(scalar "select md5(coalesce(string_agg(concat_ws('|',fact_id::text,employee_id::text,value_revision::text,evidence_basis_revision::text,attribution_state,coalesce(active_branch_id::text,''),coalesce(array_to_string(governing_evidence_ids,','),'')),'||' order by fact_id),'')) from public.hr_attendance_authorization_projection where house_id='$HOUSE';")"
super_sql "select public.hr_rebuild_attendance_authorization_projection('$HOUSE');"
HASH7_B="$(scalar "select md5(coalesce(string_agg(concat_ws('|',fact_id::text,employee_id::text,value_revision::text,evidence_basis_revision::text,attribution_state,coalesce(active_branch_id::text,''),coalesce(array_to_string(governing_evidence_ids,','),'')),'||' order by fact_id),'')) from public.hr_attendance_authorization_projection where house_id='$HOUSE';")"
[[ "$HASH7_A" == "$HASH7_B" ]] || fail "C7 projection rebuild is not semantically deterministic"
echo "PASS: C7 post-race projection rebuild is deterministic"

echo "C8 — raw privilege cutover and wrapper survivability"
for role in authenticated service_role; do
  if [[ "$role" == "authenticated" ]]; then
    expect_fail_auth "insert into public.dtr_segments (house_id,employee_id,work_date,time_in,source,status) values ('$HOUSE','$EMP8','2026-09-24','2026-09-24 08:00+08','manual','open');" "C8 authenticated raw dtr_segments INSERT denied"
    expect_fail_auth "update public.dtr_segments set source=source where false;" "C8 authenticated raw dtr_segments UPDATE denied"
    expect_fail_auth "delete from public.dtr_segments where false;" "C8 authenticated raw dtr_segments DELETE denied"
    expect_fail_auth "truncate table public.dtr_segments;" "C8 authenticated raw dtr_segments TRUNCATE denied"
    expect_fail_auth "insert into public.dtr_entries (employee_id,work_date) values ('$EMP8','2026-09-24');" "C8 authenticated raw dtr_entries INSERT denied"
  else
    expect_fail_service "insert into public.dtr_segments (house_id,employee_id,work_date,time_in,source,status) values ('$HOUSE','$EMP8','2026-09-24','2026-09-24 08:00+08','manual','open');" "C8 service_role raw dtr_segments INSERT denied"
    expect_fail_service "update public.dtr_segments set source=source where false;" "C8 service_role raw dtr_segments UPDATE denied"
    expect_fail_service "delete from public.dtr_segments where false;" "C8 service_role raw dtr_segments DELETE denied"
    expect_fail_service "truncate table public.dtr_segments;" "C8 service_role raw dtr_segments TRUNCATE denied"
    expect_fail_service "insert into public.dtr_entries (employee_id,work_date) values ('$EMP8','2026-09-24');" "C8 service_role raw dtr_entries INSERT denied"
  fi
done

auth_sql "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP8','$BRANCH_A','c8-manual','2026-09-24',
  '2026-09-24 08:00:00+08','2026-09-24 09:00:00+08'
);"
auth_sql "select public.hr_replace_bulk_attendance_day(
  '$HOUSE','$EMP8','2026-09-25','c8-bulk',
  '[{"timeIn":"2026-09-25T08:00:00+08:00","timeOut":"2026-09-25T17:00:00+08:00"}]'::jsonb
);"
service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP8','c8-kiosk',
  '2026-09-26 08:00:00+08'
);"

expect_fail_auth "select public.hr_apply_attendance_producer_mutation(
  '$HOUSE','$EMP8','FORGED','c8-private','x','MANUAL_CREATE',
  null,'2026-09-26','2026-09-26 08:00+08',null,
  '$BRANCH_A','$ENTITY','HOUSE_OWNER',null
);" "C8 authenticated cannot execute private mutation engine"
expect_fail_service "select public.hr_apply_attendance_producer_mutation(
  '$HOUSE','$EMP8','FORGED','c8-private','x','MANUAL_CREATE',
  null,'2026-09-26','2026-09-26 08:00+08',null,
  '$BRANCH_A','$ENTITY','HOUSE_OWNER',null
);" "C8 service_role cannot execute private mutation engine"

echo "Final canonical invariants"
assert_scalar "0" "select count(*) from public.dtr_segments s join public.hr_attendance_facts f on f.id=s.canonical_fact_id where s.house_id is distinct from f.house_id or s.employee_id is distinct from f.employee_id;" "bridge House/employee integrity"
assert_scalar "0" "select count(*) from public.hr_attendance_fact_revisions where dtr_segment_id is not null;" "Gate-B revisions never depend on deletable compatibility rows"
assert_scalar "0" "select count(*) from public.hr_attendance_facts f left join public.hr_attendance_fact_revisions r on r.house_id=f.house_id and r.fact_id=f.id and r.employee_id=f.employee_id and r.revision=f.current_value_revision left join public.hr_attendance_evidence_frames ef on ef.house_id=f.house_id and ef.fact_id=f.id and ef.employee_id=f.employee_id and ef.evidence_basis_revision=f.evidence_basis_revision where f.house_id='$HOUSE' and f.is_active and (r.fact_id is null or ef.fact_id is null or not ef.is_sealed);" "every active fact has current revision and sealed frame"
assert_scalar "0" "select count(*) from public.hr_attendance_facts f left join public.dtr_segments s on s.house_id=f.house_id and s.employee_id=f.employee_id and s.canonical_fact_id=f.id where f.house_id='$HOUSE' and f.is_active and s.id is null;" "every active Gate-B fact remains compatibility-backed"

echo "Gate-B C1-C8 disposable PostgreSQL concurrency harness: PASS"
