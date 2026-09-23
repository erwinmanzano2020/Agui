import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const relativePath =
  "supabase/migrations/20261020120000_gap024_gate_b_kiosk_command.sql";
const migrationPath = [
  resolve(process.cwd(), "..", relativePath),
  resolve(process.cwd(), "../..", relativePath),
].find(existsSync);

assert.ok(migrationPath, "Gate-B kiosk command migration must be resolvable");
const sql = readFileSync(migrationPath, "utf8");

function between(startText: string, endText?: string) {
  const start = sql.indexOf(startText);
  assert.notEqual(start, -1, `Missing SQL anchor: ${startText}`);
  const end = endText ? sql.indexOf(endText, start) : sql.length;
  return sql.slice(start, end === -1 ? sql.length : end);
}

test("kiosk wrapper validates active exact device context and is service-role only", () => {
  const wrapper = between(
    "create or replace function public.hr_apply_kiosk_attendance_scan",
  );

  assert.match(
    wrapper,
    /from public\.hr_kiosk_devices device[\s\S]*device\.id = p_device_id[\s\S]*device\.house_id = p_house_id[\s\S]*device\.branch_id = p_branch_id[\s\S]*device\.is_active/i,
  );
  assert.match(wrapper, /p_producer_namespace => 'KIOSK_SCAN_V1'/i);
  assert.match(wrapper, /p_mutation_kind => 'KIOSK_SCAN'/i);
  assert.match(
    sql,
    /revoke all on function public\.hr_apply_kiosk_attendance_scan[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.hr_apply_kiosk_attendance_scan[\s\S]*to service_role/i,
  );
});

test("private engine resolves replay before the kiosk action decision", () => {
  const engine = between(
    "create or replace function public.hr_apply_attendance_producer_mutation",
    "create or replace function public.hr_apply_kiosk_attendance_scan",
  );

  const replay = engine.indexOf("if v_existing_outcome is not null then");
  const kioskDispatch = engine.indexOf("if p_mutation_kind = 'KIOSK_SCAN' then");
  const helperCall = engine.indexOf("hr_attendance_apply_kiosk_scan_locked", kioskDispatch);

  assert.ok(replay >= 0 && replay < kioskDispatch);
  assert.ok(helperCall > kioskDispatch);
  assert.match(engine, /jsonb_build_object\('replayed', true\)/i);
});

test("serialized kiosk helper owns debounce and IN/OUT selection", () => {
  const helper = between(
    "create or replace function public.hr_attendance_apply_kiosk_scan_locked",
    "create or replace function public.hr_apply_attendance_producer_mutation",
  );

  assert.match(
    helper,
    /source_namespace = 'KIOSK_SCAN_V1'[\s\S]*event_type in \('clock_in', 'clock_out'\)/i,
  );
  assert.match(
    helper,
    /abs\(extract\(epoch from \(p_occurred_at - v_last_occurred_at\)\)\) < 10/i,
  );
  assert.match(
    helper,
    /from public\.dtr_segments segment[\s\S]*segment\.status = 'open'[\s\S]*for update/i,
  );
  assert.match(helper, /'action', 'debounced'/i);
  assert.match(helper, /'action', 'clock_in'/i);
  assert.match(helper, /'action', 'clock_out'/i);
});

test("new kiosk facts create stable observation identity and established IN evidence", () => {
  const helper = between(
    "create or replace function public.hr_attendance_apply_kiosk_scan_locked",
    "create or replace function public.hr_apply_attendance_producer_mutation",
  );

  assert.match(
    helper,
    /insert into public\.hr_attendance_observations[\s\S]*'KIOSK_SCAN_V1', btrim\(p_source_observation_id\), p_occurred_at/i,
  );
  assert.match(
    helper,
    /'KIOSK', 'LOGICAL_IN', p_branch_id[\s\S]*'ESTABLISHED', 'VALID', 'SUFFICIENT'/i,
  );
  assert.match(
    helper,
    /update public\.dtr_segments[\s\S]*set canonical_fact_id = v_fact_id/i,
  );
});

test("legacy open checkout canonicalizes without fabricating IN provenance", () => {
  const helper = between(
    "create or replace function public.hr_attendance_apply_kiosk_scan_locked",
    "create or replace function public.hr_apply_attendance_producer_mutation",
  );
  const legacy = helper.indexOf("if v_segment.canonical_fact_id is null then");
  const emptyFrame = helper.indexOf(
    "insert into public.hr_attendance_evidence_frames",
    legacy,
  );
  const initialRebuild = helper.indexOf(
    "perform public.hr_rebuild_attendance_authorization_projection(p_house_id);",
    legacy,
  );
  const outEvidence = helper.indexOf("'KIOSK', 'LOGICAL_OUT', p_branch_id", legacy);

  assert.ok(legacy >= 0);
  assert.ok(emptyFrame > legacy);
  assert.ok(initialRebuild > emptyFrame);
  assert.ok(outEvidence > initialRebuild);
  assert.doesNotMatch(
    helper.slice(legacy, initialRebuild),
    /'KIOSK', 'LOGICAL_IN'/i,
  );
});

test("checkout carries prior evidence into a new completed frame and rejects stale occurrence", () => {
  const helper = between(
    "create or replace function public.hr_attendance_apply_kiosk_scan_locked",
    "create or replace function public.hr_apply_attendance_producer_mutation",
  );

  assert.match(
    helper,
    /p_occurred_at <= v_segment\.time_in[\s\S]*using errcode = '40001'/i,
  );
  assert.match(
    helper,
    /insert into public\.hr_attendance_fact_evidence[\s\S]*select[\s\S]*v_next_basis[\s\S]*existing\.evidence_id/i,
  );
  assert.match(
    helper,
    /'KIOSK', 'LOGICAL_OUT', p_branch_id[\s\S]*'ESTABLISHED', 'VALID', 'SUFFICIENT'/i,
  );
  assert.match(
    helper,
    /set current_value_revision = v_next_revision,[\s\S]*evidence_basis_revision = v_next_basis/i,
  );
});

test("kiosk canonical revisions never depend on legacy dtr_segment_id", () => {
  const helper = between(
    "create or replace function public.hr_attendance_apply_kiosk_scan_locked",
    "create or replace function public.hr_apply_attendance_producer_mutation",
  );
  const revisionWrites = helper.match(
    /insert into public\.hr_attendance_fact_revisions[\s\S]*?values \([\s\S]*?\);/gi,
  ) ?? [];

  assert.ok(revisionWrites.length >= 2);
  for (const write of revisionWrites) {
    assert.match(write, /dtr_segment_id[\s\S]*null,/i);
  }
});
