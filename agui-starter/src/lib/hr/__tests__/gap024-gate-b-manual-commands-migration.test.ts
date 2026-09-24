import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const relativePath =
  "supabase/migrations/20261020110000_gap024_gate_b_manual_commands.sql";
const migrationPath = [
  resolve(process.cwd(), "..", relativePath),
  resolve(process.cwd(), "../..", relativePath),
].find(existsSync);

assert.ok(migrationPath, "Gate-B manual command migration must be resolvable");
const sql = readFileSync(migrationPath, "utf8");

function between(startText: string, endText?: string) {
  const start = sql.indexOf(startText);
  assert.notEqual(start, -1, `Missing SQL anchor: ${startText}`);
  const end = endText ? sql.indexOf(endText, start) : sql.length;
  return sql.slice(start, end === -1 ? sql.length : end);
}

test("private engine serializes House + employee and fingerprints operation identity", () => {
  const engine = between(
    "create or replace function public.hr_apply_attendance_producer_mutation",
    "create or replace function public.hr_create_manual_attendance",
  );

  assert.match(
    engine,
    /pg_advisory_xact_lock[\s\S]*gap024\.attendance_mutation:[\s\S]*p_house_id[\s\S]*p_employee_id/i,
  );
  assert.match(
    engine,
    /insert into public\.hr_attendance_mutation_operations[\s\S]*on conflict \(house_id, producer_namespace, operation_id\) do nothing/i,
  );
  assert.match(
    engine,
    /v_existing_fingerprint is distinct from btrim\(p_request_fingerprint\)[\s\S]*reused with different input/i,
  );
  assert.match(
    engine,
    /if v_existing_outcome is not null then[\s\S]*return v_existing_outcome/i,
  );
});

test("manual create atomically builds fact, explicit evidence, bridge, generation, and projection", () => {
  const engine = between(
    "create or replace function public.hr_apply_attendance_producer_mutation",
    "create or replace function public.hr_create_manual_attendance",
  );

  assert.match(engine, /p_mutation_kind = 'MANUAL_CREATE'/i);
  assert.match(engine, /insert into public\.dtr_segments/i);
  assert.match(engine, /insert into public\.hr_attendance_facts/i);
  assert.match(
    engine,
    /insert into public\.hr_attendance_fact_revisions[\s\S]*dtr_segment_id[\s\S]*null, p_work_date/i,
  );
  assert.match(engine, /'MANUAL_ADMIN', 'EXPLICIT_BRANCH', p_actual_branch_id/i);
  assert.match(engine, /'ESTABLISHED', 'VALID', 'SUFFICIENT'/i);
  assert.match(
    engine,
    /update public\.dtr_segments[\s\S]*set canonical_fact_id = v_fact_id/i,
  );
  assert.match(engine, /hr_attendance_bump_employee_generation/i);
  assert.match(engine, /hr_rebuild_attendance_authorization_projection/i);
});

test("legacy manual update classifies revision 1 before advancing revision 2", () => {
  const engine = between(
    "create or replace function public.hr_apply_attendance_producer_mutation",
    "create or replace function public.hr_create_manual_attendance",
  );
  const legacyStart = engine.indexOf("if v_segment.canonical_fact_id is null then");
  const initialRebuild = engine.indexOf(
    "perform public.hr_rebuild_attendance_authorization_projection(p_house_id);",
    legacyStart,
  );
  const revisionInsert = engine.indexOf(
    "insert into public.hr_attendance_fact_revisions",
    initialRebuild + 1,
  );
  const pointerUpdate = engine.indexOf(
    "set current_value_revision = v_next_revision",
    legacyStart,
  );

  assert.ok(legacyStart >= 0, "legacy bridge path must exist");
  assert.ok(initialRebuild > legacyStart, "legacy revision 1 must be classified");
  assert.ok(revisionInsert > initialRebuild, "revision 2 must follow initial classification");
  assert.ok(pointerUpdate > revisionInsert, "fact pointer advances after revision 2 exists");
  assert.match(
    engine,
    /p_expected_value_revision is null[\s\S]*p_expected_value_revision <> v_fact\.current_value_revision[\s\S]*Attendance fact revision is stale/i,
  );
});

test("manual create wrapper derives actor authority and cannot self-assert producer lane", () => {
  const wrapper = between(
    "create or replace function public.hr_create_manual_attendance",
    "create or replace function public.hr_update_manual_attendance",
  );

  assert.match(wrapper, /v_entity_id := public\.current_entity_id\(\)/i);
  assert.match(
    wrapper,
    /hr_attendance_actor_can_write_branch\([\s\S]*p_actual_branch_id[\s\S]*select employee\.branch_id[\s\S]*v_employee_branch_id[\s\S]*hr_attendance_actor_can_write_branch\([\s\S]*v_employee_branch_id/i,
  );
  assert.match(wrapper, /Attendance employee target is outside caller write scope/i);
  assert.match(wrapper, /hr_attendance_actor_role_label/i);
  assert.match(wrapper, /p_producer_namespace => 'MANUAL_ADMIN_V1'/i);
  assert.match(wrapper, /p_mutation_kind => 'MANUAL_CREATE'/i);
  assert.doesNotMatch(wrapper, /p_producer_namespace text/i);
});

test("manual update wrapper fails closed for unattributed branch-limited legacy facts", () => {
  const wrapper = between(
    "create or replace function public.hr_update_manual_attendance",
    "create or replace function public.hr_get_dtr_mutation_tokens",
  );

  assert.match(wrapper, /hr_attendance_actor_has_broad_write/i);
  assert.match(
    wrapper,
    /if v_fact_id is null then[\s\S]*Unattributed legacy attendance requires House-wide write authority/i,
  );
  assert.match(
    wrapper,
    /v_attribution_state is distinct from 'ATTRIBUTED'[\s\S]*hr_attendance_actor_can_write_branch/i,
  );
});

test("public execution is limited to producer wrappers and safe mutation-token read", () => {
  assert.match(
    sql,
    /revoke all on function public\.hr_apply_attendance_producer_mutation[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.hr_create_manual_attendance[\s\S]*to authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.hr_update_manual_attendance[\s\S]*to authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.hr_get_dtr_mutation_tokens\(uuid, uuid\[\]\)[\s\S]*to authenticated/i,
  );
  assert.doesNotMatch(sql, /grant execute[\s\S]*hr_apply_attendance_producer_mutation[\s\S]*to authenticated/i);
});
