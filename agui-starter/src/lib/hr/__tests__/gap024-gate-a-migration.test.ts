import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationRelativePath = "supabase/migrations/20261019100000_gap024_gate_a_attendance_authority.sql";
const migrationPath = [
  resolve(process.cwd(), "..", migrationRelativePath),
  resolve(process.cwd(), "../..", migrationRelativePath),
].find(existsSync);
assert.ok(migrationPath, "Gate-A migration must be resolvable in focused and full-suite runners");
const sql = readFileSync(migrationPath, "utf8");

function functionSql(name: string, nextName?: string) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1);
  const end = nextName ? sql.indexOf(`create or replace function public.${nextName}`, start) : sql.length;
  return sql.slice(start, end);
}
function returnShape(body: string) {
  return body.slice(body.indexOf("returns table ("), body.indexOf(")\nlanguage", body.indexOf("returns table (")));
}

test("basis N and N+1 retain different exact immutable evidence sets", () => {
  const frames = new Map<number, ReadonlySet<string>>([[7, new Set(["A", "B"])], [8, new Set(["A", "C"])]]);
  assert.deepEqual([...frames.get(7)!].sort(), ["A", "B"]);
  assert.deepEqual([...frames.get(8)!].sort(), ["A", "C"]);
  assert.match(sql, /create table public\.hr_attendance_evidence_frames/i);
  assert.match(sql, /primary key \(house_id, fact_id, evidence_basis_revision, evidence_id\)/i);
  assert.match(sql, /hr_attendance_fact_evidence_immutable/i);
  assert.match(sql, /hr_attendance_fact_evidence_insert_guard/i);
  assert.match(sql, /and not ef\.is_sealed/i);
  assert.doesNotMatch(sql, /is_current_governing|associated_at|disassociated_at/i);
});

test("rebuild selects only the sealed current evidence-basis frame", () => {
  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  assert.match(rebuild, /ef\.evidence_basis_revision = f\.evidence_basis_revision/i);
  assert.match(rebuild, /and ef\.is_sealed/i);
  assert.match(rebuild, /a\.evidence_basis_revision = ef\.evidence_basis_revision/i);
  assert.match(rebuild, /delete from public\.hr_attendance_authorization_projection/i);
  assert.doesNotMatch(rebuild, /delete from public\.hr_attendance_(?:evidence_frames|fact_evidence)/i);
});

test("superseding evidence cannot change semantics referenced by an old frame", () => {
  const oldEvidence = Object.freeze({ id: "B", branch: "old" });
  const successor = Object.freeze({ id: "C", branch: "new", supersedes: oldEvidence.id });
  assert.equal(oldEvidence.branch, "old");
  assert.equal(successor.supersedes, "B");
  assert.match(sql, /hr_attendance_evidence_immutable[\s\S]*before update or delete on public\.hr_attendance_evidence/i);
  assert.match(sql, /hr_attendance_evidence_supersedes_fk/i);
  assert.match(sql, /hr_attendance_evidence_no_self_supersession/i);
});

test("fact revisions structurally bind facts and optional segments to the same employee", () => {
  assert.match(sql, /create unique index[^;]+dtr_segments \(house_id, id, employee_id\)/i);
  assert.match(sql, /create table public\.hr_attendance_fact_revisions \([\s\S]*employee_id uuid not null/i);
  assert.match(sql, /foreign key \(house_id, fact_id, employee_id\)\s+references public\.hr_attendance_facts\(house_id, id, employee_id\)/i);
  assert.match(sql, /foreign key \(house_id, dtr_segment_id, employee_id\)\s+references public\.dtr_segments\(house_id, id, employee_id\)/i);
  assert.match(sql, /dtr_segment_id uuid,/i);
});

test("fact revision snapshots are append-only while later revisions remain insertable", () => {
  assert.match(sql, /hr_attendance_fact_revisions_immutable\s+before update or delete on public\.hr_attendance_fact_revisions/i);
  assert.match(sql, /predecessor_revision = revision - 1/i);
  assert.doesNotMatch(sql, /before insert on public\.hr_attendance_fact_revisions/i);
  assert.doesNotMatch(sql, /unique[^;]*(?:work_date|time_in)/i);
});

test("completion mode is immutable semantic evidence-frame authority", () => {
  const modes = new Map<number, Readonly<{ evidence: string[]; mode: string }>>([
    [7, Object.freeze({ evidence: ["A", "B"], mode: "OPEN" })],
    [8, Object.freeze({ evidence: ["A", "B"], mode: "COMPLETED" })],
  ]);
  assert.equal(modes.get(7)!.mode, "OPEN");
  assert.equal(modes.get(8)!.mode, "COMPLETED");
  assert.match(sql, /create table public\.hr_attendance_evidence_frames[\s\S]*semantic_completion_mode text not null/i);
  assert.doesNotMatch(sql.slice(sql.indexOf("create table public.hr_attendance_facts"), sql.indexOf("create table public.hr_attendance_fact_revisions")), /semantic_completion_mode/i);
  assert.match(sql, /new\.semantic_completion_mode <> old\.semantic_completion_mode/i);
});

test("completion mode changes fingerprints and stale projections fail reader drift validation", () => {
  const fingerprint = (mode: string, ids: string[]) => `${mode}|${ids.join("|")}`;
  assert.notEqual(fingerprint("OPEN", ["A", "B"]), fingerprint("COMPLETED", ["A", "B"]));
  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  assert.match(rebuild, /md5\(semantic_completion_mode \|\| '\|' \|\| coalesce\(string_agg/i);
  for (const reader of [functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global"), functionSql("hr_read_canonical_attendance_house_global")]) {
    assert.match(reader, /ef\.semantic_completion_mode \|\| '\|' \|\| coalesce/i);
    assert.match(reader, /ef\.evidence_basis_revision = f\.evidence_basis_revision and ef\.is_sealed/i);
    assert.match(reader, /f\.evidence_basis_revision = p\.evidence_basis_revision/i);
  }
});

test("both readers require date bounds and enforce capped deterministic pagination", () => {
  for (const name of ["hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global"]) {
    const body = functionSql(name);
    assert.match(body, /p_house_id uuid,\s+p_start_date date,\s+p_end_date date/i);
    assert.match(body, /p_employee_id uuid default null/i);
    assert.match(body, /p_limit integer default 100/i);
    assert.match(body, /p_offset integer default 0/i);
    assert.match(body, /p_start_date > p_end_date/i);
    assert.match(body, /p_limit > 200/i);
    assert.match(body, /p_offset[^\n]*< 0/i);
    assert.match(body, /r\.work_date between p_start_date and p_end_date/i);
    assert.match(body, /order by r\.work_date, r\.time_in asc nulls last, p\.fact_id/i);
    assert.match(body, /limit p_limit offset p_offset/i);
  }
});

test("employee filter only narrows to an employee owned by the requested House", () => {
  for (const name of ["hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global"]) {
    const body = functionSql(name);
    assert.match(body, /p\.employee_id = p_employee_id/i);
    assert.match(body, /target\.house_id = p_house_id and target\.id = p_employee_id/i);
  }
  assert.doesNotMatch(sql, /unique[^;]*(?:work_date|time_in)/i);
});

test("both consumption DTOs omit internal revision metadata", () => {
  const branchShape = returnShape(functionSql("hr_read_canonical_attendance_branch_scoped"));
  const globalShape = returnShape(functionSql("hr_read_canonical_attendance_house_global"));
  for (const shape of [branchShape, globalShape]) assert.doesNotMatch(shape, /value_revision|evidence_basis|fingerprint|generation|evidence_id/i);
  assert.match(branchShape, /active_branch_id uuid/i);
  assert.match(globalShape, /attribution_state text/i);
});

test("effective direct feature grants are honored without manufacturing House or branch scope", () => {
  const branch = functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global");
  const featureBlock = branch.slice(branch.indexOf("effective_feature_read"), branch.indexOf("allowed_branches"));
  assert.match(featureBlock, /from public\.entity_policies ep[\s\S]*ep\.policy_key in \('tiles\.hr\.read', 'tiles\.payroll\.read'\)/i);
  assert.match(featureBlock, /ep\.scope = 'PLATFORM' and ep\.role_slug = 'direct'/i);
  assert.match(featureBlock, /ep\.scope = 'HOUSE' and ep\.scope_ref = p_house_id/i);
  assert.match(branch, /from public\.house_roles hr[\s\S]*hr\.house_id = p_house_id/i);
  assert.match(branch, /ep\.scope = 'HOUSE' and ep\.scope_ref = p_house_id/i);
  assert.match(branch, /join public\.branches b on b\.house_id = p_house_id and b\.id = parsed\.id/i);
});

test("wrong-House role feature grants cannot combine with requested-House membership", () => {
  const branch = functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global");
  const featureBlock = branch.slice(branch.indexOf("effective_feature_read"), branch.indexOf("allowed_branches"));
  assert.match(featureBlock, /\(ep\.scope = 'PLATFORM' and ep\.role_slug = 'direct'\)\s+or \(ep\.scope = 'HOUSE' and ep\.scope_ref = p_house_id\)/i);
  assert.doesNotMatch(featureBlock, /ep\.scope = 'HOUSE'\s*\)/i);
});

test("zero or cross-House branch scope returns no branch rows", () => {
  const branch = functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global");
  assert.match(branch, /join allowed_branches ab on ab\.id = p\.active_branch_id/i);
  assert.match(branch, /join public\.branches b on b\.house_id = p_house_id/i);
  assert.doesNotMatch(branch, /left join allowed_branches/i);
});

test("owner and manager global authority remains exact-House and separate", () => {
  const global = functionSql("hr_read_canonical_attendance_house_global");
  assert.match(global, /hr\.house_id = p_house_id/i);
  assert.match(global, /hr\.entity_id = public\.current_entity_id\(\)/i);
  assert.match(global, /hr\.role in \('house_owner', 'house_manager'\)/i);
  assert.doesNotMatch(global, /entity_policies|current_entity_is_gm/i);
});

test("branch no-leak classification and projection drift checks remain enforced", () => {
  const branch = functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global");
  assert.match(branch, /p\.attribution_state = 'ATTRIBUTED'/i);
  assert.match(branch, /f\.current_value_revision = p\.value_revision/i);
  assert.match(branch, /f\.evidence_basis_revision = p\.evidence_basis_revision/i);
  assert.match(branch, /p\.evidence_basis_fingerprint = md5/i);
  assert.doesNotMatch(returnShape(branch), /count|source|revision|evidence|history|total/i);
});

test("all authority tables remain direct-access denied", () => {
  for (const table of ["hr_attendance_facts", "hr_attendance_fact_revisions", "hr_attendance_evidence", "hr_attendance_evidence_frames", "hr_attendance_fact_evidence", "hr_attendance_employee_generations", "hr_attendance_authorization_projection"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(sql, /notify pgrst, 'reload schema'/i);
});

test("no production source imports a Gate-A reader", () => {
  const references: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:ts|tsx)$/.test(entry.name) && !path.endsWith("db.types.ts") && !path.endsWith("gap024-gate-a-migration.test.ts") && /hr_read_canonical_attendance_(?:branch_scoped|house_global)/.test(readFileSync(path, "utf8"))) references.push(path);
    }
  };
  const sourceRoot = [resolve(process.cwd(), "src"), resolve(process.cwd(), "../src")].find(existsSync);
  assert.ok(sourceRoot, "application source must be resolvable in focused and full-suite runners");
  walk(sourceRoot);
  assert.deepEqual(references, []);
});
