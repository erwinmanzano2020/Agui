#!/usr/bin/env bash
set -euo pipefail

HOUSE="11000000-0000-0000-0000-000000000001"
BRANCH_A="21000000-0000-0000-0000-000000000001"
BRANCH_B="21000000-0000-0000-0000-000000000002"
OWNER_USER="31000000-0000-0000-0000-000000000001"
OWNER_ENTITY="41000000-0000-0000-0000-000000000001"
BRANCH_USER="31000000-0000-0000-0000-000000000002"
BRANCH_ENTITY="41000000-0000-0000-0000-000000000002"
BRANCH_ROLE="71000000-0000-0000-0000-000000000001"
DEVICE="61000000-0000-0000-0000-000000000001"

EMP1="51000000-0000-0000-0000-000000000001"
EMP2="51000000-0000-0000-0000-000000000002"
EMP3="51000000-0000-0000-0000-000000000003"
EMP4="51000000-0000-0000-0000-000000000004"
EMP5="51000000-0000-0000-0000-000000000005"
EMP6="51000000-0000-0000-0000-000000000006"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

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

auth_sql_as() {
  local user_id="$1"
  local body="$2"
  psql_super <<SQL
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"$user_id","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '10s';
$body
COMMIT;
SQL
}

auth_scalar_as() {
  local user_id="$1"
  local query="$2"
  docker exec -i "$DB_CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
BEGIN;
DO \$do\$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"$user_id","role":"authenticated"}',
    true
  );
END
\$do\$;
SET LOCAL ROLE authenticated;
$query
ROLLBACK;
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

expect_fail_auth_as() {
  local user_id="$1"
  local sql="$2"
  local label="$3"
  set +e
  auth_sql_as "$user_id" "$sql" >"$TMP_DIR/expected-fail.log" 2>&1
  local rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    cat "$TMP_DIR/expected-fail.log"
    fail "$label unexpectedly succeeded"
  fi
  echo "PASS: $label"
}

expect_fail_super() {
  local sql="$1"
  local label="$2"
  set +e
  psql_super -c "$sql" >"$TMP_DIR/expected-super-fail.log" 2>&1
  local rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    cat "$TMP_DIR/expected-super-fail.log"
    fail "$label unexpectedly succeeded"
  fi
  echo "PASS: $label"
}

TODAY="$(scalar "select (transaction_timestamp() at time zone 'Asia/Manila')::date;")"
YESTERDAY="$(scalar "select ((transaction_timestamp() at time zone 'Asia/Manila')::date - 1);")"
TOMORROW="$(scalar "select ((transaction_timestamp() at time zone 'Asia/Manila')::date + 1);")"

echo "P1 fixture Manila date: $TODAY"

psql_super <<SQL
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  ('$OWNER_USER', 'authenticated', 'authenticated', 'p1-owner@example.invalid', '', now(), now(), now()),
  ('$BRANCH_USER', 'authenticated', 'authenticated', 'p1-branch@example.invalid', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.entities (id, kind, display_name, universal_code, is_gm)
values
  ('$OWNER_ENTITY', 'PERSON', 'P1 Owner', 'P1-OWNER', false),
  ('$BRANCH_ENTITY', 'PERSON', 'P1 Branch Writer', 'P1-BRANCH', false)
on conflict (id) do nothing;

insert into public.accounts (user_id, entity_id)
values
  ('$OWNER_USER', '$OWNER_ENTITY'),
  ('$BRANCH_USER', '$BRANCH_ENTITY')
on conflict (user_id) do update set entity_id = excluded.entity_id;

insert into public.houses (id, slug, name, house_type)
values ('$HOUSE', 'p1-ci-house', 'P1 CI House', 'RETAIL')
on conflict (id) do nothing;

insert into public.branches (id, house_id, name, slug)
values
  ('$BRANCH_A', '$HOUSE', 'P1 Branch A', 'p1-branch-a'),
  ('$BRANCH_B', '$HOUSE', 'P1 Branch B', 'p1-branch-b')
on conflict (id) do nothing;

insert into public.house_roles (house_id, entity_id, role)
values ('$HOUSE', '$OWNER_ENTITY', 'house_owner')
on conflict do nothing;

insert into public.roles (id, key, slug, scope, scope_ref)
values ('$BRANCH_ROLE', 'p1_branch_writer', 'p1_branch_writer', 'HOUSE', '$HOUSE')
on conflict (id) do update
set key=excluded.key, slug=excluded.slug, scope=excluded.scope, scope_ref=excluded.scope_ref;

insert into public.policies (id, key)
values
  ('72000000-0000-0000-0000-000000000001', 'domain.hr.all'),
  ('72000000-0000-0000-0000-000000000002', 'tiles.hr.read'),
  ('72000000-0000-0000-0000-000000000003', 'hr.branch.$BRANCH_A')
on conflict (id) do update set key=excluded.key;

insert into public.role_policies (role_id, policy_id)
values
  ('$BRANCH_ROLE', '72000000-0000-0000-0000-000000000001'),
  ('$BRANCH_ROLE', '72000000-0000-0000-0000-000000000002'),
  ('$BRANCH_ROLE', '72000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.house_roles (house_id, entity_id, role_id, role)
values ('$HOUSE', '$BRANCH_ENTITY', '$BRANCH_ROLE', 'p1_branch_writer')
on conflict do nothing;

insert into public.employees (id, code, full_name, rate_per_day, status, branch_id, house_id)
values
  ('$EMP1', 'P1-E01', 'P1 Employee 01', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP2', 'P1-E02', 'P1 Employee 02', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP3', 'P1-E03', 'P1 Employee 03', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP4', 'P1-E04', 'P1 Employee 04', 0, 'active', '$BRANCH_A', '$HOUSE'),
  ('$EMP5', 'P1-E05', 'P1 Employee 05', 0, 'active', '$BRANCH_B', '$HOUSE'),
  ('$EMP6', 'P1-E06', 'P1 Employee 06', 0, 'active', '$BRANCH_A', '$HOUSE')
on conflict (id) do nothing;

insert into public.hr_kiosk_devices (
  id, house_id, branch_id, name, token_hash, is_active
)
values (
  '$DEVICE', '$HOUSE', '$BRANCH_A',
  'P1 CI Kiosk', 'p1-ci-token-hash', true
)
on conflict (id) do update
set house_id=excluded.house_id, branch_id=excluded.branch_id, is_active=true;
SQL

echo "P1-A — grants and Option A+ boundary"
assert_scalar "f" "select has_function_privilege('authenticated', 'public.hr_update_manual_attendance(uuid,uuid,text,timestamp with time zone,timestamp with time zone,bigint)', 'EXECUTE');" "old immediate update RPC is not authenticated-executable"
assert_scalar "t" "select has_function_privilege('authenticated', 'public.hr_propose_attendance_correction(uuid,uuid,text,date,timestamp with time zone,timestamp with time zone,uuid,text)', 'EXECUTE');" "correction proposal wrapper is executable"
assert_scalar "f" "select has_function_privilege('authenticated', 'public.hr_apply_attendance_p1_finalization(uuid,uuid,text,uuid,uuid,date,timestamp with time zone,timestamp with time zone,uuid,uuid,text,bigint,bigint,text)', 'EXECUTE');" "private P1 finalization helper is not app-executable"

expect_fail_auth_as "$OWNER_USER" "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','old-create','$YESTERDAY',
  '$YESTERDAY 08:00:00+08','$YESTERDAY 17:00:00+08'
);" "Option A+ denies historical ordinary create even to owner"
expect_fail_auth_as "$OWNER_USER" "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','future-create','$TOMORROW',
  '$TOMORROW 08:00:00+08','$TOMORROW 17:00:00+08'
);" "Option A+ denies future ordinary create"

auth_sql_as "$OWNER_USER" "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP1','$BRANCH_A','today-create','$TODAY',
  '$TODAY 08:00:00+08','$TODAY 17:00:00+08'
);"
FACT1="$(scalar "select canonical_fact_id from public.dtr_segments where employee_id='$EMP1' order by created_at desc limit 1;")"
[[ -n "$FACT1" ]] || fail "same-day manual create did not create canonical fact"

echo "P1-B — pure location correction finalizes without HR-4"
PROPOSE_LOC="$(auth_scalar_as "$OWNER_USER" "select public.hr_propose_attendance_correction(
  '$HOUSE','$FACT1','loc-propose','$TODAY',
  '$TODAY 08:00:00+08','$TODAY 17:00:00+08',
  '$BRANCH_B','Correct actual attendance branch'
)::text;")"
LOC_CASE="$(printf '%s' "$PROPOSE_LOC" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
[[ -n "$LOC_CASE" ]] || fail "location correction case missing"
assert_scalar "f" "select has_function_privilege('authenticated', 'public.hr_attendance_actor_has_broad_write(uuid,uuid)', 'EXECUTE');" "broad-write helper remains private"
assert_scalar "f" "select has_function_privilege('authenticated', 'public.hr_attendance_actor_can_write_branch(uuid,uuid,uuid)', 'EXECUTE');" "branch-write helper remains private"
assert_scalar "f" "select has_function_privilege('authenticated', 'public.hr_attendance_actor_role_label(uuid,uuid,uuid)', 'EXECUTE');" "actor-role helper remains private"
assert_scalar "f" "select has_function_privilege('authenticated', 'public.hr_resolve_attendance_fact_write_context(uuid,uuid,uuid)', 'EXECUTE');" "exact-fact resolver remains private"
auth_sql_as "$OWNER_USER" "select public.hr_finalize_attendance_correction(
  '$HOUSE','$LOC_CASE','loc-finalize'
);"
assert_scalar "$BRANCH_B" "select active_branch_id::text from public.hr_attendance_authorization_projection where house_id='$HOUSE' and fact_id='$FACT1';" "pure location correction changes canonical attribution"
assert_scalar "2" "select evidence_basis_revision from public.hr_attendance_facts where id='$FACT1';" "location correction advances evidence basis only"
assert_scalar "1" "select current_value_revision from public.hr_attendance_facts where id='$FACT1';" "location correction preserves value revision"
assert_scalar "1" "select count(*) from public.hr_attendance_correction_events where correction_case_id='$LOC_CASE' and event_class='FINALIZED';" "location correction has one terminal event"

echo "P1-C — payroll-impacting value correction fails closed without HR-4"
PROPOSE_VALUE="$(auth_scalar_as "$OWNER_USER" "select public.hr_propose_attendance_correction(
  '$HOUSE','$FACT1','value-propose','$TODAY',
  '$TODAY 08:15:00+08','$TODAY 17:00:00+08',
  null,'Correct time in'
)::text;")"
VALUE_CASE="$(printf '%s' "$PROPOSE_VALUE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
VALUE_FINAL="$(auth_scalar_as "$OWNER_USER" "select public.hr_finalize_attendance_correction(
  '$HOUSE','$VALUE_CASE','value-finalize'
)::text;")"
printf '%s' "$VALUE_FINAL" | grep -q 'APPROVAL_DEPENDENCY_UNAVAILABLE' || fail "value correction did not fail closed on absent HR-4"
assert_scalar "1" "select current_value_revision from public.hr_attendance_facts where id='$FACT1';" "HR-4 unavailable leaves active value unchanged"
assert_scalar "OPEN" "select lifecycle_status from public.hr_attendance_correction_cases where id='$VALUE_CASE';" "approval-unavailable case stays open"

echo "P1-C2 — modeled authoritative HR-4 rejection is terminal and no-write"
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
  select jsonb_build_object(
    'status', 'REJECTED',
    'decisionReference', 'CI-HR4-REJECTED'
  )
$function$;
revoke all on function public.hr_attendance_p1_hr4_decision(uuid,text,uuid,text)
  from public, anon, authenticated, service_role;
SQL

REJECT_PROPOSE="$(auth_scalar_as "$OWNER_USER" "select public.hr_propose_attendance_correction(
  '$HOUSE','$FACT1','reject-propose','$TODAY',
  '$TODAY 08:30:00+08','$TODAY 17:00:00+08',
  null,'Rejected correction'
)::text;")"
REJECT_CASE="$(printf '%s' "$REJECT_PROPOSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
REJECT_RESULT="$(auth_scalar_as "$OWNER_USER" "select public.hr_finalize_attendance_correction(
  '$HOUSE','$REJECT_CASE','reject-finalize'
)::text;")"
printf '%s' "$REJECT_RESULT" | grep -q '"status": "REJECTED"' || fail "authoritative HR-4 rejection was not preserved"
assert_scalar "REJECTED" "select lifecycle_status from public.hr_attendance_correction_cases where id='$REJECT_CASE';" "rejected correction is terminal"
assert_scalar "1" "select count(*) from public.hr_attendance_correction_events where correction_case_id='$REJECT_CASE' and event_class='REJECTED';" "rejected correction has one terminal event"
assert_scalar "1" "select current_value_revision from public.hr_attendance_facts where id='$FACT1';" "rejected correction leaves active value unchanged"

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
revoke all on function public.hr_attendance_p1_hr4_decision(uuid,text,uuid,text)
  from public, anon, authenticated, service_role;
SQL

echo "P1-D — branch-limited hidden fact collapses to TARGET_UNAVAILABLE without operation oracle"
auth_sql_as "$OWNER_USER" "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP5','$BRANCH_B','hidden-create','$TODAY',
  '$TODAY 09:00:00+08','$TODAY 18:00:00+08'
);"
HIDDEN_FACT="$(scalar "select canonical_fact_id from public.dtr_segments where employee_id='$EMP5' order by created_at desc limit 1;")"
HIDDEN_RESULT="$(auth_scalar_as "$BRANCH_USER" "select public.hr_propose_attendance_correction(
  '$HOUSE','$HIDDEN_FACT','hidden-propose','$TODAY',
  '$TODAY 09:15:00+08','$TODAY 18:00:00+08',
  null,'Attempt hidden correction'
)::text;")"
printf '%s' "$HIDDEN_RESULT" | grep -q 'TARGET_UNAVAILABLE' || fail "hidden target did not collapse to TARGET_UNAVAILABLE"
assert_scalar "0" "select count(*) from public.hr_attendance_mutation_operations where operation_id='hidden-propose';" "unauthorized guess creates no operation-ledger oracle"

HIDDEN_CASE_PROPOSE="$(auth_scalar_as "$OWNER_USER" "select public.hr_propose_attendance_correction(
  '$HOUSE','$HIDDEN_FACT','hidden-case-owner-propose','$TODAY',
  '$TODAY 09:15:00+08','$TODAY 18:00:00+08',
  null,'Owner prepares hidden fact correction'
)::text;")"
HIDDEN_CASE="$(printf '%s' "$HIDDEN_CASE_PROPOSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
HIDDEN_FINALIZE="$(auth_scalar_as "$BRANCH_USER" "select public.hr_finalize_attendance_correction(
  '$HOUSE','$HIDDEN_CASE','hidden-case-finalize'
)::text;")"
printf '%s' "$HIDDEN_FINALIZE" | grep -q 'TARGET_UNAVAILABLE' || fail "hidden correction case finalization did not collapse to TARGET_UNAVAILABLE"
assert_scalar "0" "select count(*) from public.hr_attendance_mutation_operations where producer_namespace='P1_CORRECTION_FINALIZE_V1' and operation_id='hidden-case-finalize';" "hidden correction case creates no finalization operation-ledger oracle"

echo "P1-E — DEC-018 open/adjudicate/fail-closed finalization"
OPEN_REM="$(auth_scalar_as "$OWNER_USER" "select public.hr_open_attendance_remediation_case(
  '$HOUSE','$EMP2','rem-open','$YESTERDAY',
  '$YESTERDAY 08:00:00+08','$YESTERDAY 17:00:00+08',
  '$BRANCH_A','Missing historical attendance'
)::text;")"
REM_CASE="$(printf '%s' "$OPEN_REM" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
printf '%s' "$OPEN_REM" | grep -q '"coverageComplete": true' || fail "empty employee universe should be complete"
auth_sql_as "$OWNER_USER" "select public.hr_adjudicate_attendance_remediation_case(
  '$HOUSE','$REM_CASE','rem-adjudicate','DISTINCT_NEW',null
);"
REM_UNAVAILABLE="$(auth_scalar_as "$OWNER_USER" "select public.hr_finalize_attendance_remediation_case(
  '$HOUSE','$REM_CASE','rem-finalize-unavailable'
)::text;")"
printf '%s' "$REM_UNAVAILABLE" | grep -q 'APPROVAL_DEPENDENCY_UNAVAILABLE' || fail "distinct-new did not fail closed on absent HR-4"
assert_scalar "0" "select count(*) from public.hr_attendance_facts where employee_id='$EMP2';" "unapproved remediation creates no fact"

echo "P1-F — modeled approved HR-4 creates exactly one durable remediation fact"
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
  select jsonb_build_object(
    'status', 'APPROVED',
    'decisionReference', 'CI-HR4-APPROVED'
  )
$function$;
revoke all on function public.hr_attendance_p1_hr4_decision(uuid,text,uuid,text)
  from public, anon, authenticated, service_role;
SQL

auth_sql_as "$OWNER_USER" "select public.hr_finalize_attendance_remediation_case(
  '$HOUSE','$REM_CASE','rem-finalize-approved'
);"
assert_scalar "1" "select count(*) from public.hr_attendance_facts where employee_id='$EMP2' and is_active;" "approved remediation creates one canonical fact"
assert_scalar "1" "select count(*) from public.hr_attendance_observations where house_id='$HOUSE' and employee_id='$EMP2' and source_namespace='P1_MANUAL_REMEDIATION_V1' and source_observation_id='$REM_CASE';" "remediation case is durable manual observation identity"
auth_sql_as "$OWNER_USER" "select public.hr_finalize_attendance_remediation_case(
  '$HOUSE','$REM_CASE','rem-finalize-approved'
);"
assert_scalar "1" "select count(*) from public.hr_attendance_facts where employee_id='$EMP2' and is_active;" "exact finalization retry does not duplicate fact"

echo "P1-G — changed candidate universe stales distinct-new adjudication"
OPEN_STALE="$(auth_scalar_as "$OWNER_USER" "select public.hr_open_attendance_remediation_case(
  '$HOUSE','$EMP4','stale-open','$YESTERDAY',
  '$YESTERDAY 07:00:00+08','$YESTERDAY 16:00:00+08',
  '$BRANCH_A','Historical attendance candidate'
)::text;")"
STALE_CASE="$(printf '%s' "$OPEN_STALE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
auth_sql_as "$OWNER_USER" "select public.hr_adjudicate_attendance_remediation_case(
  '$HOUSE','$STALE_CASE','stale-adjudicate','DISTINCT_NEW',null
);"
auth_sql_as "$OWNER_USER" "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP4','$BRANCH_A','stale-new-evidence','$TODAY',
  '$TODAY 10:00:00+08','$TODAY 11:00:00+08'
);"
STALE_RESULT="$(auth_scalar_as "$OWNER_USER" "select public.hr_finalize_attendance_remediation_case(
  '$HOUSE','$STALE_CASE','stale-finalize'
)::text;")"
printf '%s' "$STALE_RESULT" | grep -q '"status": "STALE"' || fail "changed candidate universe did not stale remediation"
assert_scalar "STALE" "select lifecycle_status from public.hr_attendance_remediation_cases where id='$STALE_CASE';" "stale remediation records derived lifecycle"

echo "P1-G2 — candidate changes before adjudication require refreshed review"
OPEN_PRE_ADJ="$(auth_scalar_as "$OWNER_USER" "select public.hr_open_attendance_remediation_case(
  '$HOUSE','$EMP3','pre-adj-open','$YESTERDAY',
  '$YESTERDAY 06:00:00+08','$YESTERDAY 15:00:00+08',
  '$BRANCH_A','Review changing candidate universe'
)::text;")"
PRE_ADJ_CASE="$(printf '%s' "$OPEN_PRE_ADJ" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
auth_sql_as "$OWNER_USER" "select public.hr_create_manual_attendance(
  '$HOUSE','$EMP3','$BRANCH_A','pre-adj-evidence','$TODAY',
  '$TODAY 06:30:00+08','$TODAY 15:30:00+08'
);"
EMP3_FACT="$(scalar "select canonical_fact_id from public.dtr_segments where employee_id='$EMP3' order by created_at desc limit 1;")"
PRE_ADJ_STALE="$(auth_scalar_as "$OWNER_USER" "select public.hr_adjudicate_attendance_remediation_case(
  '$HOUSE','$PRE_ADJ_CASE','pre-adj-stale','DISTINCT_NEW',null
)::text;")"
printf '%s' "$PRE_ADJ_STALE" | grep -q '"status": "STALE"' || fail "changed pre-adjudication universe was not returned for review"
printf '%s' "$PRE_ADJ_STALE" | grep -q "FACT:$EMP3_FACT" || fail "stale review result did not include current candidate universe"
assert_scalar "0" "select count(*) from public.hr_attendance_remediation_events where remediation_case_id='$PRE_ADJ_CASE' and event_class like 'ADJUDICATED_%';" "stale pre-adjudication attempt records no adjudication"
PRE_ADJ_REVIEWED="$(auth_scalar_as "$OWNER_USER" "select public.hr_adjudicate_attendance_remediation_case(
  '$HOUSE','$PRE_ADJ_CASE','pre-adj-reviewed','EXISTING_RELATED','FACT:$EMP3_FACT'
)::text;")"
printf '%s' "$PRE_ADJ_REVIEWED" | grep -q '"status": "EXISTING_RELATED"' || fail "reviewed refreshed universe could not be adjudicated"
assert_scalar "1" "select count(*) from public.hr_attendance_facts where employee_id='$EMP3' and is_active;" "refreshed existing-related review creates no duplicate"

echo "P1-H — existing/related adjudication never creates a duplicate"
OPEN_EXISTING="$(auth_scalar_as "$OWNER_USER" "select public.hr_open_attendance_remediation_case(
  '$HOUSE','$EMP1','existing-open','$YESTERDAY',
  '$YESTERDAY 08:00:00+08','$YESTERDAY 17:00:00+08',
  '$BRANCH_A','Check related attendance'
)::text;")"
EXISTING_CASE="$(printf '%s' "$OPEN_EXISTING" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"
FACT_IDENTITY="FACT:$FACT1"
EXISTING_RESULT="$(auth_scalar_as "$OWNER_USER" "select public.hr_adjudicate_attendance_remediation_case(
  '$HOUSE','$EXISTING_CASE','existing-adjudicate','EXISTING_RELATED','$FACT_IDENTITY'
)::text;")"
printf '%s' "$EXISTING_RESULT" | grep -q '"route": "CORRECTION"' || fail "existing fact did not route to correction"
assert_scalar "1" "select count(*) from public.hr_attendance_facts where employee_id='$EMP1' and is_active;" "existing/related adjudication creates no duplicate fact"

echo "P1-I — shared serialization: location correction and kiosk close do not deadlock"
service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP6','race-open',
  '$TODAY 12:00:00+08'
);"
RACE_FACT="$(scalar "select canonical_fact_id from public.dtr_segments where employee_id='$EMP6' and status='open' order by created_at desc limit 1;")"
RACE_PROPOSE="$(auth_scalar_as "$OWNER_USER" "select public.hr_propose_attendance_correction(
  '$HOUSE','$RACE_FACT','race-propose','$TODAY',
  '$TODAY 12:00:00+08',null,'$BRANCH_B','Correct race branch'
)::text;")"
RACE_CASE="$(printf '%s' "$RACE_PROPOSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["caseId"])')"

psql_super <<SQL >"$TMP_DIR/race-correction.log" 2>&1 &
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"$OWNER_USER","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '10s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'gap024.attendance_mutation:$HOUSE:$EMP6', 0
  )
);
select public.hr_finalize_attendance_correction(
  '$HOUSE','$RACE_CASE','race-finalize'
);
select pg_sleep(1);
COMMIT;
SQL
p1=$!
sleep 0.2
service_sql "select public.hr_apply_kiosk_attendance_scan(
  '$HOUSE','$BRANCH_A','$DEVICE','$EMP6','race-close',
  '$TODAY 17:00:00+08'
);" >"$TMP_DIR/race-kiosk.log" 2>&1 &
p2=$!

set +e
wait "$p1"; rc1=$?
wait "$p2"; rc2=$?
set -e
if [[ $rc1 -ne 0 || $rc2 -ne 0 ]]; then
  echo "--- correction ---"; cat "$TMP_DIR/race-correction.log" || true
  echo "--- kiosk ---"; cat "$TMP_DIR/race-kiosk.log" || true
  fail "serialized correction/kiosk race failed (correction=$rc1 kiosk=$rc2)"
fi
echo "PASS: correction/kiosk race completes without deadlock"

echo "P1-J — raw writes and new P1 tables remain non-bypassable"
assert_scalar "f" "select has_table_privilege('authenticated','public.hr_attendance_correction_cases','INSERT');" "authenticated cannot write correction table"
assert_scalar "f" "select has_table_privilege('service_role','public.hr_attendance_remediation_cases','UPDATE');" "service_role cannot mutate remediation table"
assert_scalar "f" "select has_table_privilege('authenticated','public.dtr_segments','UPDATE');" "raw DTR update remains denied"
expect_fail_super "update public.hr_attendance_correction_cases set reason='tampered' where id='$LOC_CASE';" "correction proposal body is database-immutable"
expect_fail_super "update public.hr_attendance_correction_events set details='{}'::jsonb where correction_case_id='$LOC_CASE';" "correction lifecycle events are append-only"
expect_fail_super "update public.hr_attendance_remediation_cases set reason='tampered' where id='$REM_CASE';" "remediation case body is database-immutable"
expect_fail_super "delete from public.hr_attendance_remediation_events where remediation_case_id='$REM_CASE';" "remediation lifecycle events are append-only"

echo "Historical Daily DTR P1 database harness passed."
