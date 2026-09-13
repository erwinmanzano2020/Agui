import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  process.cwd(),
  "../supabase/migrations/20261019100000_gap024_gate_a_attendance_authority.sql",
);
const sql = readFileSync(migrationPath, "utf8");

function includesAll(parts: string[]) {
  for (const part of parts) assert.match(sql, new RegExp(part, "i"));
}

test("Gate A creates separate durable fact, evidence, association, generation, and projection authorities", () => {
  includesAll([
    "create table public\\.hr_attendance_facts",
    "create table public\\.hr_attendance_fact_revisions",
    "create table public\\.hr_attendance_evidence",
    "create table public\\.hr_attendance_fact_evidence",
    "create table public\\.hr_attendance_employee_generations",
    "create table public\\.hr_attendance_authorization_projection",
    "current_value_revision bigint",
    "evidence_basis_revision bigint",
    "candidate_evidence_generation bigint",
    "predecessor_revision",
    "dtr_segment_id uuid",
  ]);
});

test("same-House and same-employee integrity is database enforced", () => {
  includesAll([
    "foreign key \\(house_id, employee_id\\)\\s+references public\\.employees\\(house_id, id\\)",
    "foreign key \\(house_id, branch_id\\)\\s+references public\\.branches\\(house_id, id\\)",
    "foreign key \\(house_id, fact_id, employee_id\\)",
    "foreign key \\(house_id, evidence_id, employee_id\\)",
  ]);
});

test("classifier preserves conflict precedence and independent sufficiency", () => {
  const conflict = sql.indexOf("when established_branch_count > 1 then 'CONFLICT'");
  const attributed = sql.indexOf("then 'ATTRIBUTED'", conflict);
  assert.ok(conflict >= 0 && attributed > conflict);
  includesAll([
    "explicit_lane_sufficient",
    "semantic_completion_mode = 'OPEN' and kiosk_in_count = 1 and kiosk_out_count = 0 and kiosk_unresolved_count = 0",
    "semantic_completion_mode = 'COMPLETED' and kiosk_in_count = 1 and kiosk_out_count = 1 and kiosk_unresolved_count = 0",
    "else 'UNATTRIBUTED'",
    "integrity_state = 'ESTABLISHED' and is_integrity_eligible and branch_id is not null",
  ]);
});

test("protected readers derive authority and fail closed on projection drift", () => {
  includesAll([
    "hr_read_canonical_attendance_branch_scoped\\(p_house_id uuid\\)",
    "join allowed_branches ab on ab\\.id = p\\.active_branch_id",
    "p\\.attribution_state = 'ATTRIBUTED'",
    "hr_read_canonical_attendance_house_global\\(p_house_id uuid\\)",
    "hr\\.role in \\('house_owner', 'house_manager'\\)",
    "f\\.current_value_revision = p\\.value_revision",
    "f\\.evidence_basis_revision = p\\.evidence_basis_revision",
    "p\\.evidence_basis_fingerprint = md5",
  ]);
  assert.doesNotMatch(sql, /employees\.branch_id/i);
  assert.doesNotMatch(sql, /device[^\n]*branch/i);
});

test("new authority tables are direct-access denied and schema cache is reloaded", () => {
  for (const table of [
    "hr_attendance_facts",
    "hr_attendance_fact_revisions",
    "hr_attendance_evidence",
    "hr_attendance_fact_evidence",
    "hr_attendance_employee_generations",
    "hr_attendance_authorization_projection",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(sql, /notify pgrst, 'reload schema'/i);
});
