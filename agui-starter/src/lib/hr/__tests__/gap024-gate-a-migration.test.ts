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

test("kiosk lane requires an exact reconciled set without vetoing a sufficient explicit lane", () => {
  type Observation = { kind: "IN" | "OUT"; state: "ESTABLISHED" | "UNRESOLVED" | "INVALID"; eligible: boolean; sufficient: boolean; branch?: string };
  const classify = (mode: "OPEN" | "COMPLETED", observations: Observation[], explicitBranch?: string) => {
    const establishedBranches = new Set(observations.filter((o) => o.state === "ESTABLISHED" && o.eligible && o.branch).map((o) => o.branch!));
    if (explicitBranch) establishedBranches.add(explicitBranch);
    if (establishedBranches.size > 1) return "CONFLICT";
    const valid = observations.filter((o) => o.state === "ESTABLISHED" && o.eligible && o.sufficient && o.branch);
    const unreconciled = observations.some((o) => !(o.state === "ESTABLISHED" && o.eligible && o.sufficient && o.branch));
    const kioskSufficient = !unreconciled
      && valid.filter((o) => o.kind === "IN").length === 1
      && valid.filter((o) => o.kind === "OUT").length === (mode === "COMPLETED" ? 1 : 0);
    return establishedBranches.size === 1 && (kioskSufficient || Boolean(explicitBranch)) ? "ATTRIBUTED" : "UNATTRIBUTED";
  };
  const validIn = { kind: "IN", state: "ESTABLISHED", eligible: true, sufficient: true, branch: "A" } as const;
  const validOut = { kind: "OUT", state: "ESTABLISHED", eligible: true, sufficient: true, branch: "A" } as const;
  assert.equal(classify("OPEN", [validIn]), "ATTRIBUTED");
  assert.equal(classify("OPEN", [validIn, { ...validOut, state: "INVALID" }]), "UNATTRIBUTED");
  assert.equal(classify("OPEN", [validIn, { ...validOut, state: "UNRESOLVED" }]), "UNATTRIBUTED");
  assert.equal(classify("OPEN", [validIn, { ...validOut, eligible: false }]), "UNATTRIBUTED");
  assert.equal(classify("COMPLETED", [validIn, validOut]), "ATTRIBUTED");
  assert.equal(classify("COMPLETED", [validIn, { ...validOut, state: "INVALID" }]), "UNATTRIBUTED");
  assert.equal(classify("OPEN", [validIn, { ...validOut, state: "INVALID" }], "A"), "ATTRIBUTED");
  assert.equal(classify("COMPLETED", [validIn, { ...validOut, branch: "B" }]), "CONFLICT");

  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  assert.match(rebuild, /lane = 'KIOSK' and not \([\s\S]*integrity_state = 'ESTABLISHED'[\s\S]*is_integrity_eligible[\s\S]*branch_id is not null[\s\S]*sufficiency_state = 'SUFFICIENT'[\s\S]*\) as kiosk_unreconciled_count/i);
  assert.match(rebuild, /when established_branch_count > 1 then 'CONFLICT'/i);
  assert.match(rebuild, /coalesce\(explicit_lane_sufficient, false\)\s+or[\s\S]*kiosk_unreconciled_count = 0/i);
  assert.doesNotMatch(rebuild, /kiosk_unresolved_count/i);
});

test("canonical evidence serializes first binding and can recur only for the same fact", () => {
  const guard = functionSql("hr_guard_attendance_frame_membership_insert", "hr_rebuild_attendance_authorization_projection");
  assert.match(guard, /from public\.hr_attendance_evidence e[\s\S]*e\.house_id = new\.house_id[\s\S]*e\.id = new\.evidence_id[\s\S]*e\.employee_id = new\.employee_id[\s\S]*for update/i);
  assert.match(guard, /from public\.hr_attendance_fact_evidence existing[\s\S]*existing\.evidence_id = new\.evidence_id[\s\S]*existing\.fact_id <> new\.fact_id/i);
  assert.match(guard, /from public\.hr_attendance_evidence_frames ef[\s\S]*and not ef\.is_sealed[\s\S]*for update/i);
  assert.doesNotMatch(sql, /unique\s*\(house_id, evidence_id\)/i);
  assert.match(sql, /primary key \(house_id, fact_id, evidence_basis_revision, evidence_id\)/i);
  assert.match(sql, /foreign key \(house_id, evidence_id, employee_id\)/i);
});

test("DEC-019 stores one namespaced stable observation chain with immutable occurrence time", () => {
  const observations = new Map<string, { occurredAt: string; recordedAt: string }>();
  const insert = (house: string, namespace: string, sourceId: string, occurredAt: string, recordedAt: string) => {
    const key = `${house}|${namespace}|${sourceId}`;
    if (!observations.has(key)) observations.set(key, { occurredAt, recordedAt });
    return observations.get(key)!;
  };
  const first = insert("H", "offline-source-A", "opaque-1", "2026-01-01T08:00:00Z", "2026-01-02T09:00:00Z");
  assert.strictEqual(insert("H", "offline-source-A", "opaque-1", first.occurredAt, "2026-01-03T09:00:00Z"), first);
  assert.notStrictEqual(insert("H", "offline-source-B", "opaque-1", first.occurredAt, first.recordedAt), first);
  assert.notStrictEqual(insert("H", "offline-source-A", "opaque-2", first.occurredAt, first.recordedAt), first);
  assert.notEqual(first.occurredAt, first.recordedAt);

  assert.match(sql, /create table public\.hr_attendance_observations/i);
  assert.match(sql, /unique \(house_id, source_namespace, source_observation_id\)/i);
  assert.match(sql, /occurred_at timestamptz not null[\s\S]*recorded_at timestamptz not null default now\(\)/i);
  assert.match(sql, /hr_attendance_observations_immutable\s+before update or delete/i);
  assert.match(sql, /foreign key \(house_id, observation_id, employee_id\)/i);
  assert.match(sql, /foreign key \(house_id, supersedes_evidence_id, employee_id, observation_id\)/i);
  assert.match(sql, /unique index hr_attendance_evidence_observation_semantic_revision_unique_idx/i);
  const evidenceGuard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(evidenceGuard, /predecessor\.observation_id is not distinct from new\.observation_id/i);
  assert.doesNotMatch(sql, /unique[^;]*(?:employee_id, work_date|employee_id, occurred_at|occurred_at, employee_id)/i);
  for (const body of [
    functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped"),
    functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global"),
    functionSql("hr_read_canonical_attendance_house_global"),
  ]) {
    assert.match(body, /source_namespace[\s\S]*source_observation_id[\s\S]*extract\(epoch from (?:o\.)?occurred_at\)/i);
  }
});

test("kiosk authority requires a trustworthy stable observation identity and occurrence time", () => {
  assert.match(sql, /constraint hr_attendance_evidence_kiosk_observation_authority_check check[\s\S]*lane <> 'KIOSK'[\s\S]*integrity_state <> 'ESTABLISHED'[\s\S]*sufficiency_state <> 'SUFFICIENT'[\s\S]*observation_id is not null/i);
  assert.match(sql, /source_namespace text not null/i);
  assert.match(sql, /source_observation_id text not null/i);
  assert.match(sql, /occurred_at timestamptz not null/i);
  assert.doesNotMatch(sql, /clientEventId|client_event_id/i);
});

test("sufficient explicit provenance requires durable authorization audit", () => {
  const eligible = (lane: "MANUAL_ADMIN" | "BULK_IMPORT", actor: string | null, namespace: string | null, reference: string | null, assertedAt: string | null) =>
    Boolean(namespace?.trim() && reference?.trim() && assertedAt && (lane !== "MANUAL_ADMIN" || actor));
  assert.equal(eligible("MANUAL_ADMIN", "entity-A", "admin-command", "case-1", "2026-01-01T00:00:00Z"), true);
  assert.equal(eligible("MANUAL_ADMIN", null, "admin-command", "case-1", "2026-01-01T00:00:00Z"), false);
  assert.equal(eligible("BULK_IMPORT", null, "trusted-import", "authorization-1", "2026-01-01T00:00:00Z"), true);
  assert.equal(eligible("BULK_IMPORT", null, null, null, "2026-01-01T00:00:00Z"), false);
  assert.match(sql, /constraint hr_attendance_evidence_explicit_audit_check check[\s\S]*lane in \('MANUAL_ADMIN', 'BULK_IMPORT'\)[\s\S]*authorization_namespace is not null[\s\S]*authorization_reference is not null[\s\S]*asserted_at is not null[\s\S]*lane <> 'MANUAL_ADMIN' or asserted_by_entity_id is not null/i);
  assert.match(sql, /foreign key \(asserted_by_entity_id\)\s+references public\.entities\(id\)/i);
  const auditGuard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(auditGuard, /from public\.house_roles hr[\s\S]*hr\.house_id = new\.house_id[\s\S]*hr\.entity_id = new\.asserted_by_entity_id[\s\S]*hr\.role = new\.asserted_by_house_role[\s\S]*for key share/i);
  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  assert.match(rebuild, /explicit_lane_sufficient/i);
  assert.match(rebuild, /authorization_namespace is not null[\s\S]*authorization_reference is not null[\s\S]*asserted_at is not null[\s\S]*lane <> 'MANUAL_ADMIN' or asserted_by_entity_id is not null/i);
  assert.match(rebuild, /when established_branch_count > 1 then 'CONFLICT'/i);
});

test("physical segments serialize first binding and recur only on the same stable fact", () => {
  const guard = functionSql("hr_guard_attendance_fact_revision_segment_insert", "hr_rebuild_attendance_authorization_projection");
  assert.match(guard, /if new\.dtr_segment_id is null then[\s\S]*return new/i);
  assert.match(guard, /from public\.dtr_segments s[\s\S]*s\.house_id = new\.house_id[\s\S]*s\.id = new\.dtr_segment_id[\s\S]*s\.employee_id = new\.employee_id[\s\S]*for update/i);
  assert.match(guard, /from public\.hr_attendance_fact_revisions existing[\s\S]*existing\.dtr_segment_id = new\.dtr_segment_id[\s\S]*existing\.fact_id <> new\.fact_id/i);
  assert.match(sql, /hr_attendance_fact_revision_segment_insert_guard\s+before insert on public\.hr_attendance_fact_revisions/i);
  assert.doesNotMatch(sql, /unique\s*\(house_id, dtr_segment_id\)/i);
});

test("canonical bounded reads have a House and work-date selective revision index", () => {
  assert.match(sql, /create index hr_attendance_fact_revisions_house_work_date_idx\s+on public\.hr_attendance_fact_revisions \(house_id, work_date, time_in, fact_id, revision\)/i);
  assert.doesNotMatch(sql, /alter table public\.hr_attendance_authorization_projection[\s\S]*add[^;]*work_date/i);
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
  assert.match(sql, /existing\.fact_id <> new\.fact_id/i);
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
  for (const table of ["hr_attendance_observations", "hr_attendance_facts", "hr_attendance_fact_revisions", "hr_attendance_evidence", "hr_attendance_evidence_frames", "hr_attendance_fact_evidence", "hr_attendance_employee_generations", "hr_attendance_authorization_projection"]) {
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
