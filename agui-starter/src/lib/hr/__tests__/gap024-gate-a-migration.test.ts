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
const compatibilityMigrationRelativePath =
  "supabase/migrations/20261019110000_gap024_gate_a_live_policy_compatibility.sql";
const compatibilityMigrationPath = [
  resolve(process.cwd(), "..", compatibilityMigrationRelativePath),
  resolve(process.cwd(), "../..", compatibilityMigrationRelativePath),
].find(existsSync);
assert.ok(
  compatibilityMigrationPath,
  "Gate-A live-policy compatibility migration must be resolvable in focused and full-suite runners",
);
const compatibilitySql = readFileSync(compatibilityMigrationPath, "utf8");
const replayGuardMigrationRelativePath =
  "supabase/migrations/20261019120000_gap024_gate_a_policy_surface_replay_guard.sql";
const replayGuardMigrationPath = [
  resolve(process.cwd(), "..", replayGuardMigrationRelativePath),
  resolve(process.cwd(), "../..", replayGuardMigrationRelativePath),
].find(existsSync);
assert.ok(
  replayGuardMigrationPath,
  "Gate-A policy replay-guard migration must be resolvable in focused and full-suite runners",
);
const replayGuardSql = readFileSync(replayGuardMigrationPath, "utf8");
const roleScopeGuardMigrationRelativePath =
  "supabase/migrations/20261019130000_gap024_gate_a_role_scope_guard.sql";
const roleScopeGuardMigrationPath = [
  resolve(process.cwd(), "..", roleScopeGuardMigrationRelativePath),
  resolve(process.cwd(), "../..", roleScopeGuardMigrationRelativePath),
].find(existsSync);
assert.ok(
  roleScopeGuardMigrationPath,
  "Gate-A role-scope guard migration must be resolvable in focused and full-suite runners",
);
const roleScopeGuardSql = readFileSync(roleScopeGuardMigrationPath, "utf8");
const supersessionIndexMigrationRelativePath =
  "supabase/migrations/20261019140000_gap024_gate_a_supersession_lookup_index.sql";
const supersessionIndexMigrationPath = [
  resolve(process.cwd(), "..", supersessionIndexMigrationRelativePath),
  resolve(process.cwd(), "../..", supersessionIndexMigrationRelativePath),
].find(existsSync);
assert.ok(
  supersessionIndexMigrationPath,
  "Gate-A supersession lookup index migration must be resolvable in focused and full-suite runners",
);
const supersessionIndexSql = readFileSync(supersessionIndexMigrationPath, "utf8");
const projectionHistoryMigrationRelativePath =
  "supabase/migrations/20261019150000_gap024_gate_a_projection_history.sql";
const projectionHistoryMigrationPath = [
  resolve(process.cwd(), "..", projectionHistoryMigrationRelativePath),
  resolve(process.cwd(), "../..", projectionHistoryMigrationRelativePath),
].find(existsSync);
assert.ok(
  projectionHistoryMigrationPath,
  "Gate-A projection-history migration must be resolvable in focused and full-suite runners",
);
const projectionHistorySql = readFileSync(projectionHistoryMigrationPath, "utf8");
const activationHistoryGuardMigrationRelativePath =
  "supabase/migrations/20261019160000_gap024_gate_a_activation_history_guard.sql";
const activationHistoryGuardMigrationPath = [
  resolve(process.cwd(), "..", activationHistoryGuardMigrationRelativePath),
  resolve(process.cwd(), "../..", activationHistoryGuardMigrationRelativePath),
].find(existsSync);
assert.ok(
  activationHistoryGuardMigrationPath,
  "Gate-A activation/history guard migration must be resolvable in focused and full-suite runners",
);
const activationHistoryGuardSql = readFileSync(activationHistoryGuardMigrationPath, "utf8");
const activationHistoryPrivilegeMigrationRelativePath =
  "supabase/migrations/20261019170000_gap024_gate_a_activation_history_privilege.sql";
const activationHistoryPrivilegeMigrationPath = [
  resolve(process.cwd(), "..", activationHistoryPrivilegeMigrationRelativePath),
  resolve(process.cwd(), "../..", activationHistoryPrivilegeMigrationRelativePath),
].find(existsSync);
assert.ok(
  activationHistoryPrivilegeMigrationPath,
  "Gate-A activation/history privilege migration must be resolvable in focused and full-suite runners",
);
const activationHistoryPrivilegeSql = readFileSync(activationHistoryPrivilegeMigrationPath, "utf8");
const retiredFactPointerFreezeMigrationRelativePath =
  "supabase/migrations/20261019180000_gap024_gate_a_retired_fact_pointer_freeze.sql";
const retiredFactPointerFreezeMigrationPath = [
  resolve(process.cwd(), "..", retiredFactPointerFreezeMigrationRelativePath),
  resolve(process.cwd(), "../..", retiredFactPointerFreezeMigrationRelativePath),
].find(existsSync);
assert.ok(
  retiredFactPointerFreezeMigrationPath,
  "Gate-A retired-fact pointer-freeze migration must be resolvable in focused and full-suite runners",
);
const retiredFactPointerFreezeSql = readFileSync(retiredFactPointerFreezeMigrationPath, "utf8");








function compatibilityFunctionSql(name: string) {
  const start = compatibilitySql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1);
  return compatibilitySql.slice(start);
}


function functionSql(name: string, nextName?: string) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1);
  const end = nextName ? sql.indexOf(`create or replace function public.${nextName}`, start) : sql.length;
  return sql.slice(start, end);
}
function returnShape(body: string) {
  return body.slice(body.indexOf("returns table ("), body.indexOf(")\nlanguage", body.indexOf("returns table (")));
}

test("evidence revisions persist a constrained integrity reason class", () => {
  const evidenceTable = sql.slice(
    sql.indexOf("create table public.hr_attendance_evidence ("),
    sql.indexOf("create unique index hr_attendance_evidence_observation_semantic_revision_unique_idx"),
  );
  const vocabulary = [
    "VALID",
    "MISSING_INTEGRITY_PROOF",
    "MALFORMED_LINKAGE",
    "DUPLICATE_REPLAY_AMBIGUITY",
    "CARDINALITY_UNRECONCILED",
    "INVALID_PROVENANCE",
  ] as const;
  const stateAllowsReason = (state: "ESTABLISHED" | "UNRESOLVED" | "INVALID", reason: typeof vocabulary[number], eligible: boolean) =>
    state === "ESTABLISHED" ? reason === "VALID" && eligible
      : state === "UNRESOLVED"
        ? ["MISSING_INTEGRITY_PROOF", "DUPLICATE_REPLAY_AMBIGUITY", "CARDINALITY_UNRECONCILED"].includes(reason)
        : ["MALFORMED_LINKAGE", "DUPLICATE_REPLAY_AMBIGUITY", "CARDINALITY_UNRECONCILED", "INVALID_PROVENANCE"].includes(reason);

  assert.equal(stateAllowsReason("ESTABLISHED", "VALID", true), true);
  assert.equal(stateAllowsReason("ESTABLISHED", "VALID", false), false);
  assert.equal(stateAllowsReason("ESTABLISHED", "MALFORMED_LINKAGE", true), false);
  assert.equal(stateAllowsReason("UNRESOLVED", "VALID", true), false);
  assert.equal(stateAllowsReason("INVALID", "VALID", true), false);
  assert.equal(stateAllowsReason("UNRESOLVED", "MISSING_INTEGRITY_PROOF", false), true);
  assert.equal(stateAllowsReason("UNRESOLVED", "DUPLICATE_REPLAY_AMBIGUITY", true), true);
  assert.equal(stateAllowsReason("INVALID", "MALFORMED_LINKAGE", false), true);
  assert.equal(stateAllowsReason("INVALID", "INVALID_PROVENANCE", true), true);

  assert.match(evidenceTable, /integrity_reason_class text not null default 'MISSING_INTEGRITY_PROOF'/i);
  for (const reason of vocabulary) assert.match(evidenceTable, new RegExp(`'${reason}'`, "i"));
  assert.match(evidenceTable, /constraint hr_attendance_evidence_integrity_reason_consistency_check check/i);
  assert.match(evidenceTable, /integrity_state = 'ESTABLISHED'[\s\S]*and integrity_reason_class = 'VALID'[\s\S]*and is_integrity_eligible/i);
  assert.match(evidenceTable, /integrity_state = 'UNRESOLVED'[\s\S]*integrity_reason_class in \([\s\S]*'MISSING_INTEGRITY_PROOF'[\s\S]*'DUPLICATE_REPLAY_AMBIGUITY'[\s\S]*'CARDINALITY_UNRECONCILED'/i);
  assert.match(evidenceTable, /integrity_state = 'INVALID'[\s\S]*integrity_reason_class in \([\s\S]*'MALFORMED_LINKAGE'[\s\S]*'INVALID_PROVENANCE'/i);
  assert.match(evidenceTable, /integrity_reason_class[\s\S]*source_reference text/i);
  assert.doesNotMatch(evidenceTable, /source_reference[^,\n]*integrity_reason|integrity_reason[^,\n]*source_reference/i);

  // A changed interpretation is a new immutable successor row; it does not rewrite
  // or constrain the predecessor's reason class.
  const revisions = Object.freeze([
    Object.freeze({ id: "E1", supersedes: null, state: "UNRESOLVED", reason: "MISSING_INTEGRITY_PROOF", eligible: false }),
    Object.freeze({ id: "E2", supersedes: "E1", state: "ESTABLISHED", reason: "VALID", eligible: true }),
  ]);
  assert.deepEqual(revisions.map(({ state, reason, eligible }) => [state, reason, eligible]), [
    ["UNRESOLVED", "MISSING_INTEGRITY_PROOF", false],
    ["ESTABLISHED", "VALID", true],
  ]);
  const evidenceGuard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.doesNotMatch(evidenceGuard, /new\.integrity_reason_class is distinct from v_predecessor/i);
  assert.match(sql, /hr_attendance_evidence_immutable[\s\S]*before update or delete on public\.hr_attendance_evidence/i);
});

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

test("current fact pointers advance only through their explicit append-only predecessors", () => {
  const guard = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  const activate = (currentValue: number, nextValue: number, currentBasis: number, nextBasis: number, sealed = true) =>
    nextValue >= currentValue && nextBasis >= currentBasis
      && (nextValue === currentValue || nextValue === currentValue + 1)
      && (nextBasis === currentBasis || (nextBasis === currentBasis + 1 && sealed));
  assert.equal(activate(1, 2, 1, 1), true);
  assert.equal(activate(2, 1, 1, 1), false);
  assert.equal(activate(2, 3, 1, 2), true);
  assert.equal(activate(2, 3, 2, 1), false);
  assert.equal(activate(2, 3, 1, 2, false), false);

  assert.match(guard, /new\.current_value_revision < old\.current_value_revision[\s\S]*cannot move backward/i);
  assert.match(guard, /new\.evidence_basis_revision < old\.evidence_basis_revision[\s\S]*cannot move backward/i);
  assert.match(guard, /target_revision\.revision = new\.current_value_revision[\s\S]*target_revision\.predecessor_revision = old\.current_value_revision/i);
  assert.match(guard, /target_frame\.evidence_basis_revision = new\.evidence_basis_revision[\s\S]*target_frame\.predecessor_revision = old\.evidence_basis_revision[\s\S]*target_frame\.is_sealed/i);
  assert.match(sql, /hr_attendance_facts_activation_guard\s+before insert or update on public\.hr_attendance_facts/i);
});

test("new facts begin current authority at value revision and evidence basis one", () => {
  const mayInsert = (valueRevision: number, evidenceBasisRevision: number) =>
    valueRevision === 1 && evidenceBasisRevision === 1;
  assert.equal(mayInsert(1, 1), true);
  assert.equal(mayInsert(2, 1), false);
  assert.equal(mayInsert(1, 2), false);
  assert.equal(mayInsert(2, 2), false);

  const guard = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  assert.match(guard, /if tg_op = 'INSERT' then[\s\S]*new\.current_value_revision <> 1 or new\.evidence_basis_revision <> 1[\s\S]*must begin at value revision and evidence basis 1[\s\S]*return new/i);
  assert.match(guard, /if new\.current_value_revision > old\.current_value_revision[\s\S]*explicit predecessor/i);
  assert.match(guard, /if new\.evidence_basis_revision > old\.evidence_basis_revision[\s\S]*next sealed frame/i);
});

test("fact active state permits retirement but never resurrection", () => {
  const transitionAllowed = (oldActive: boolean, newActive: boolean) => oldActive || !newActive;
  assert.equal(transitionAllowed(true, true), true);
  assert.equal(transitionAllowed(true, false), true);
  assert.equal(transitionAllowed(false, false), true);
  assert.equal(transitionAllowed(false, true), false);
  assert.equal(transitionAllowed(false, true) && 3 > 2, false);
  assert.equal(transitionAllowed(false, true) && 4 > 3, false);

  const guard = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  const resurrectionCheck = guard.indexOf("if not old.is_active and new.is_active");
  const valueAdvanceCheck = guard.indexOf("if new.current_value_revision > old.current_value_revision");
  const evidenceAdvanceCheck = guard.indexOf("if new.evidence_basis_revision > old.evidence_basis_revision");
  assert.ok(resurrectionCheck >= 0 && resurrectionCheck < valueAdvanceCheck && resurrectionCheck < evidenceAdvanceCheck);
  assert.match(guard, /Retired canonical attendance facts cannot be reactivated/i);
  assert.match(guard, /new\.id is distinct from old\.id[\s\S]*new\.house_id is distinct from old\.house_id[\s\S]*new\.employee_id is distinct from old\.employee_id/i);
  assert.doesNotMatch(guard, /status\s*=.*is_active|is_active\s*=.*status/i);
});

test("current evidence authority follows supersession forward and cannot reactivate ancestors or siblings", () => {
  const predecessor = new Map<string, string | null>([
    ["E1", null], ["E2a", "E1"], ["E2b", "E1"], ["E3", "E2a"],
    ["Other1", null], ["Other2", "Other1"],
  ]);
  const descendsFrom = (candidate: string, prior: string) => {
    let cursor: string | null | undefined = candidate;
    while (cursor) {
      if (cursor === prior) return true;
      cursor = predecessor.get(cursor);
    }
    return false;
  };
  assert.equal(descendsFrom("E2a", "E1"), true);
  assert.equal(descendsFrom("E1", "E2a"), false);
  assert.equal(descendsFrom("E3", "E2a"), true);
  assert.equal(descendsFrom("E2b", "E2a"), false);
  assert.equal(descendsFrom("Other2", "Other1"), true);

  const guard = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  assert.match(guard, /with recursive target_ancestry as/i);
  assert.match(guard, /predecessor\.id = ancestry\.supersedes_evidence_id/i);
  assert.match(guard, /prior_membership\.evidence_basis_revision <= old\.evidence_basis_revision/i);
  assert.match(guard, /permitted_path\.ancestor_evidence_id = prior\.evidence_id/i);
  assert.match(guard, /cannot regress or switch supersession paths/i);
  const executableGuard = guard.slice(0, guard.indexOf("$function$;")).replace(/--.*$/gm, "");
  assert.doesNotMatch(executableGuard, /max\s*\([^)]*semantic_revision|recorded_at|created_at|occurred_at|order by[^\n]*(?:semantic_revision|recorded_at|created_at|occurred_at)|latest_write/i);
  assert.match(sql, /hr_attendance_evidence_frames_immutable\s+before update or delete/i);
});

test("targets requiring leafness lock before successor inspection", () => {
  const successors = new Map<string, string[]>([
    ["E1", ["E2"]], ["E2", ["E3"]], ["E3", []],
    ["SiblingRoot", ["E2a", "E2b"]], ["E2a", []], ["E2b", []],
    ["LeafRoot", []],
  ]);
  const mayFirstGovern = (selected: string) => (successors.get(selected) ?? []).length === 0;
  assert.equal(mayFirstGovern("LeafRoot"), true);
  assert.equal(mayFirstGovern("E1"), false);
  assert.equal(mayFirstGovern("E2"), false);
  assert.equal(mayFirstGovern("E3"), true);
  assert.equal(mayFirstGovern("E2a"), true);
  assert.equal(mayFirstGovern("E2b"), true);

  const activation = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  const targetLock = activation.indexOf("order by target_evidence.lineage_root_evidence_id, target_evidence.id");
  const successorCheck = activation.indexOf("join public.hr_attendance_evidence successor", targetLock);
  assert.ok(targetLock >= 0 && targetLock < successorCheck, "new target evidence must lock before its successor check");
  assert.match(activation, /order by target_evidence\.lineage_root_evidence_id, target_evidence\.id\s+for update of target_evidence/i);
  assert.match(activation, /successor\.house_id = target_evidence\.house_id[\s\S]*successor\.employee_id = target_evidence\.employee_id[\s\S]*successor\.lineage_root_evidence_id = target_evidence\.lineage_root_evidence_id[\s\S]*successor\.supersedes_evidence_id = target_evidence\.id/i);
  assert.match(activation, /current_membership\.evidence_basis_revision = old\.evidence_basis_revision[\s\S]*current_evidence\.id = target_evidence\.id[\s\S]*Target current evidence must be an unsuperseded lineage member/i);
  assert.match(activation, /with recursive target_ancestry as/i);
  assert.match(activation, /cannot regress or switch supersession paths/i);

  const evidenceInsert = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(evidenceInsert, /predecessor\.id = new\.supersedes_evidence_id[\s\S]*for update/i);
  const executableActivation = activation.slice(0, activation.indexOf("$function$;")).replace(/--.*$/gm, "");
  assert.doesNotMatch(executableActivation, /max\s*\([^)]*semantic_revision|recorded_at|created_at|occurred_at|order by[^\n]*semantic_revision|latest_write/i);
});

test("continuous lineage advances require a leaf while same-member carry-forward remains valid", () => {
  const predecessor = new Map<string, string | null>([
    ["E1", null], ["E2", "E1"], ["E3", "E2"],
  ]);
  const hasDirectSuccessor = (selected: string) => [...predecessor.values()].includes(selected);
  const descendsFrom = (selected: string, current: string) => {
    let cursor: string | null | undefined = selected;
    while (cursor) {
      if (cursor === current) return true;
      cursor = predecessor.get(cursor);
    }
    return false;
  };
  const mayContinuouslySelect = (current: string, target: string) =>
    target === current || (descendsFrom(target, current) && !hasDirectSuccessor(target));

  assert.equal(mayContinuouslySelect("E1", "E2"), false); // E3 makes E2 stale.
  assert.equal(mayContinuouslySelect("E1", "E3"), true); // E3 is the current leaf.
  assert.equal(mayContinuouslySelect("E1", "E1"), true); // Appended E2 does not force advancement.
  predecessor.delete("E3");
  assert.equal(mayContinuouslySelect("E1", "E2"), true); // Simple E1 -> leaf E2 advance.

  const activation = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  const targetLock = activation.indexOf("order by target_evidence.lineage_root_evidence_id, target_evidence.id");
  const successorCheck = activation.indexOf("join public.hr_attendance_evidence successor", targetLock);
  assert.ok(targetLock >= 0 && targetLock < successorCheck,
    "continuous-advance target must lock before direct-successor inspection");
  assert.match(activation, /not exists \([\s\S]*current_evidence\.lineage_root_evidence_id = target_evidence\.lineage_root_evidence_id[\s\S]*current_evidence\.id = target_evidence\.id[\s\S]*order by target_evidence\.lineage_root_evidence_id, target_evidence\.id\s+for update of target_evidence/i);
  assert.match(activation, /successor\.house_id = target_evidence\.house_id[\s\S]*successor\.employee_id = target_evidence\.employee_id[\s\S]*successor\.lineage_root_evidence_id = target_evidence\.lineage_root_evidence_id[\s\S]*successor\.supersedes_evidence_id = target_evidence\.id/i);
  assert.match(activation, /with recursive target_ancestry as/i);
  assert.match(activation, /cannot regress or switch supersession paths/i);

  const evidenceInsert = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(evidenceInsert, /predecessor\.id = new\.supersedes_evidence_id[\s\S]*for update/i);
});

test("omitting a governing lineage establishes a serialized retirement boundary", () => {
  const successor = new Map<string, string | null>([["E1", null], ["E2", "E1"]]);
  const mayRetire = (member: string) => ![...successor.values()].includes(member);
  const descendsStrictly = (selected: string, retiredMember: string) => {
    let cursor = successor.get(selected);
    while (cursor) {
      if (cursor === retiredMember) return true;
      cursor = successor.get(cursor);
    }
    return false;
  };
  const mayReenter = (retiredMember: string, selected: string) =>
    descendsStrictly(selected, retiredMember) && mayRetire(selected);
  const isEntering = (oldRoots: Set<string>, targetRoot: string) => !oldRoots.has(targetRoot);

  assert.equal(isEntering(new Set(["L1"]), "L1"), false); // continuous E1 or E1 -> E2
  assert.equal(isEntering(new Set(), "L1"), true); // first-ever or retired re-entry

  assert.equal(mayRetire("E1"), false); // committed E2 blocks omission
  successor.delete("E2");
  assert.equal(mayRetire("E1"), true); // retirement may win before successor append
  assert.equal(mayReenter("E1", "E1"), false);
  successor.set("E2", "E1");
  assert.equal(mayReenter("E1", "E2"), true);
  successor.set("E3", "E2");
  assert.equal(mayReenter("E1", "E2"), false); // selected descendant must itself be a leaf
  assert.equal(mayReenter("E1", "E3"), true);

  const activation = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  const retirementLock = activation.indexOf("order by current_evidence.lineage_root_evidence_id, current_evidence.id");
  const retirementSuccessorCheck = activation.indexOf("join public.hr_attendance_evidence successor", retirementLock);
  assert.ok(retirementLock >= 0 && retirementLock < retirementSuccessorCheck,
    "omitted governing evidence must lock before successor inspection");
  assert.match(activation, /current_membership\.evidence_basis_revision = old\.evidence_basis_revision[\s\S]*not exists \([\s\S]*target_membership\.evidence_basis_revision = new\.evidence_basis_revision[\s\S]*order by current_evidence\.lineage_root_evidence_id, current_evidence\.id\s+for update of current_evidence/i);
  assert.match(activation, /successor\.supersedes_evidence_id = current_evidence\.id[\s\S]*cannot retire after its governing member was superseded/i);
  assert.match(activation, /prior_membership\.evidence_basis_revision < old\.evidence_basis_revision[\s\S]*prior_membership\.evidence_id = target_evidence\.id[\s\S]*must re-enter through a strict successor/i);
  assert.match(activation, /with recursive target_ancestry as/i);
  assert.match(activation, /Target current evidence must be an unsuperseded lineage member/i);

  const evidenceInsert = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(evidenceInsert, /predecessor\.id = new\.supersedes_evidence_id[\s\S]*for update/i);
});

test("sealing the current first frame rejects selected evidence already superseded", () => {
  const successors = new Map<string, string[]>([
    ["E1", ["E2"]], ["E2", ["E3"]], ["E3", []],
    ["SiblingRoot", ["E2a", "E2b"]], ["E2a", []], ["E2b", []],
    ["LeafRoot", []],
  ]);
  const maySealCurrentFrame = (selected: string) => (successors.get(selected) ?? []).length === 0;
  assert.equal(maySealCurrentFrame("LeafRoot"), true);
  assert.equal(maySealCurrentFrame("E1"), false);
  assert.equal(maySealCurrentFrame("E2"), false);
  assert.equal(maySealCurrentFrame("E3"), true);
  assert.equal(maySealCurrentFrame("E2a"), true);

  const frameGuard = functionSql("hr_guard_attendance_evidence_frame", "hr_guard_attendance_evidence_insert");
  assert.match(frameGuard, /fact\.house_id = new\.house_id[\s\S]*fact\.id = new\.fact_id[\s\S]*fact\.employee_id = new\.employee_id[\s\S]*for update/i);
  assert.match(frameGuard, /if v_current_evidence_basis_revision = new\.evidence_basis_revision then/i);
  const selectedLock = frameGuard.indexOf("order by selected_evidence.lineage_root_evidence_id, selected_evidence.id");
  const successorCheck = frameGuard.indexOf("join public.hr_attendance_evidence successor");
  assert.ok(selectedLock >= 0 && selectedLock < successorCheck, "current-frame evidence must lock before successor inspection");
  assert.match(frameGuard, /order by selected_evidence\.lineage_root_evidence_id, selected_evidence\.id\s+for update of selected_evidence/i);
  assert.match(frameGuard, /successor\.house_id = selected_evidence\.house_id[\s\S]*successor\.employee_id = selected_evidence\.employee_id[\s\S]*successor\.lineage_root_evidence_id = selected_evidence\.lineage_root_evidence_id[\s\S]*successor\.supersedes_evidence_id = selected_evidence\.id/i);
  assert.match(frameGuard, /Current evidence frame cannot seal with superseded selected evidence/i);

  const evidenceInsert = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(evidenceInsert, /predecessor\.id = new\.supersedes_evidence_id[\s\S]*for update/i);
  const activation = functionSql("hr_guard_attendance_fact_activation", "hr_rebuild_attendance_authorization_projection");
  assert.match(activation, /target_frame\.predecessor_revision = old\.evidence_basis_revision[\s\S]*target_frame\.is_sealed/i);
  assert.match(activation, /with recursive target_ancestry as/i);

  const executableFrameGuard = frameGuard.slice(0, frameGuard.indexOf("$function$;")).replace(/--.*$/gm, "");
  assert.doesNotMatch(executableFrameGuard, /max\s*\([^)]*semantic_revision|order by[^\n]*(?:semantic_revision|recorded_at|created_at|occurred_at)|latest_write/i);
});

test("Gate A does not invent manual or bulk producer retry identity", () => {
  assert.doesNotMatch(sql, /unique\s*\([^)]*(?:source_reference|authorization_reference)/i);
  assert.doesNotMatch(sql, /manual_(?:case|producer)_namespace|bulk_(?:row|producer)_namespace/i);
  assert.doesNotMatch(sql, /unique\s*\([^)]*(?:work_date|recorded_at)/i);
});

test("projection rebuilds serialize per House before deterministic replacement", () => {
  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  const lock = rebuild.indexOf("pg_catalog.pg_advisory_xact_lock");
  const deletion = rebuild.indexOf("delete from public.hr_attendance_authorization_projection");
  const insertion = rebuild.indexOf("insert into public.hr_attendance_authorization_projection");
  assert.ok(lock >= 0 && lock < deletion && deletion < insertion, "per-House transaction lock must precede DELETE/rebuild/INSERT");
  assert.match(rebuild, /hr_rebuild_attendance_authorization_projection\(p_house_id uuid\)/i);
  assert.match(rebuild, /pg_catalog\.pg_advisory_xact_lock\(\s*pg_catalog\.hashtextextended\('gap024\.attendance_projection:' \|\| p_house_id::text, 0\)/i);
  assert.doesNotMatch(rebuild, /pg_advisory_lock\s*\(/i);
  assert.doesNotMatch(sql, /create table public\.[^;]*(?:projection|rebuild)[^;]*lock/i);
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

test("kiosk completion mode recognizes exact governing evidence without vetoing explicit provenance", () => {
  type Mode = "OPEN" | "COMPLETED" | "UNRESOLVED";
  const classify = ({ mode, timeOut, status, ins, outs, explicit, conflict }: {
    mode: Mode; timeOut: string | null; status: string; ins: number; outs: number;
    explicit?: boolean; conflict?: boolean;
  }) => {
    if (conflict) return "CONFLICT";
    const knownStatus = ["open", "closed", "corrected"].includes(status.toLowerCase());
    const completionConsistent = mode === "OPEN"
      ? timeOut === null && ["open", "corrected"].includes(status.toLowerCase())
      : mode === "COMPLETED" && knownStatus;
    const kioskSufficient = completionConsistent && ins === 1
      && outs === (mode === "COMPLETED" ? 1 : 0);
    return explicit || kioskSufficient ? "ATTRIBUTED" : "UNATTRIBUTED";
  };

  assert.equal(classify({ mode: "OPEN", timeOut: null, status: "open", ins: 1, outs: 0 }), "ATTRIBUTED");
  assert.equal(classify({ mode: "OPEN", timeOut: "2026-01-01T09:00:00Z", status: "open", ins: 1, outs: 0 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "OPEN", timeOut: null, status: "closed", ins: 1, outs: 0 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "OPEN", timeOut: null, status: "pending", ins: 1, outs: 0 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "OPEN", timeOut: null, status: "closd", ins: 1, outs: 0 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "corrected", ins: 1, outs: 1 }), "ATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "open", ins: 1, outs: 1 }), "ATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "corrected", ins: 1, outs: 0 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: "2026-01-01T09:00:00Z", status: "closed", ins: 1, outs: 0 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: "2026-01-01T09:00:00Z", status: "closed", ins: 1, outs: 1 }), "ATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "pending", ins: 1, outs: 1 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "OPEN", timeOut: null, status: "corrected", ins: 1, outs: 0 }), "ATTRIBUTED");
  assert.equal(classify({ mode: "OPEN", timeOut: "2026-01-01T09:00:00Z", status: "corrected", ins: 1, outs: 0 }), "UNATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "corrected", ins: 1, outs: 1, conflict: true }), "CONFLICT");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "corrected", ins: 1, outs: 0, explicit: true }), "ATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "pending", ins: 1, outs: 0, explicit: true }), "ATTRIBUTED");
  assert.equal(classify({ mode: "COMPLETED", timeOut: null, status: "pending", ins: 1, outs: 1, conflict: true }), "CONFLICT");
  assert.equal(classify({ mode: "UNRESOLVED", timeOut: null, status: "corrected", ins: 1, outs: 1 }), "UNATTRIBUTED");

  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  assert.match(rebuild, /join public\.hr_attendance_fact_revisions current_revision[\s\S]*current_revision\.house_id = f\.house_id[\s\S]*current_revision\.fact_id = f\.id[\s\S]*current_revision\.employee_id = f\.employee_id[\s\S]*current_revision\.revision = f\.current_value_revision/i);
  assert.match(sql, /create table public\.hr_attendance_fact_revisions[\s\S]*status text not null check \(status in \('open', 'closed', 'corrected'\)\)/i);
  assert.match(rebuild, /when ef\.semantic_completion_mode = 'OPEN'[\s\S]*current_revision\.time_out is null[\s\S]*lower\(current_revision\.status\) in \('open', 'corrected'\)/i);
  assert.doesNotMatch(rebuild, /lower\(current_revision\.status\) <> 'closed'/i);
  assert.match(rebuild, /when ef\.semantic_completion_mode = 'COMPLETED'\s+then lower\(current_revision\.status\) in \('open', 'closed', 'corrected'\)/i);
  assert.doesNotMatch(rebuild, /when ef\.semantic_completion_mode = 'COMPLETED'[\s\S]{0,160}current_revision\.time_out/i);
  assert.doesNotMatch(rebuild, /when ef\.semantic_completion_mode = 'COMPLETED'[\s\S]{0,160}lower\(current_revision\.status\)\s*=\s*'closed'/i);
  assert.match(rebuild, /end as kiosk_completion_consistent/i);
  assert.match(rebuild, /coalesce\(explicit_lane_sufficient, false\)\s+or \(kiosk_completion_consistent and/i);
  assert.match(rebuild, /when established_branch_count > 1 then 'CONFLICT'[\s\S]*coalesce\(explicit_lane_sufficient, false\)[\s\S]*kiosk_completion_consistent/i);
  assert.match(rebuild, /semantic_completion_mode = 'COMPLETED' and kiosk_in_count = 1 and kiosk_out_count = 1 and kiosk_unreconciled_count = 0/i);
  assert.doesNotMatch(rebuild, /lower\(current_revision\.status\) = 'corrected'/i);
});

test("canonical evidence serializes first binding and can recur only for the same fact", () => {
  const guard = functionSql("hr_guard_attendance_frame_membership_insert", "hr_rebuild_attendance_authorization_projection");
  assert.match(guard, /from public\.hr_attendance_evidence e[\s\S]*e\.house_id = new\.house_id[\s\S]*e\.id = new\.evidence_id[\s\S]*e\.employee_id = new\.employee_id/i);
  assert.match(guard, /from public\.hr_attendance_evidence evidence_member[\s\S]*evidence_member\.id = new\.evidence_id[\s\S]*for update/i);
  assert.match(guard, /from public\.hr_attendance_fact_evidence existing[\s\S]*existing\.evidence_id = new\.evidence_id[\s\S]*existing\.fact_id <> new\.fact_id/i);
  assert.match(guard, /from public\.hr_attendance_evidence_frames ef[\s\S]*and not ef\.is_sealed[\s\S]*for update/i);
  assert.doesNotMatch(sql, /unique\s*\(house_id, evidence_id\)/i);
  assert.match(sql, /primary key \(house_id, fact_id, evidence_basis_revision, evidence_id\)/i);
  assert.match(sql, /foreign key \(house_id, evidence_id, employee_id\)/i);
});

test("every evidence supersession lineage inherits one root and one stable fact binding", () => {
  const lineage = new Map<string, string>();
  const predecessor = new Map<string, string | null>();
  const add = (id: string, supersedes: string | null) => {
    predecessor.set(id, supersedes);
    lineage.set(id, supersedes ? lineage.get(supersedes)! : id);
  };
  add("E1", null);
  add("E2", "E1");
  add("E3", "E2");
  add("E2-sibling", "E1");
  assert.equal(lineage.get("E1"), "E1");
  assert.equal(lineage.get("E2"), "E1");
  assert.equal(lineage.get("E3"), "E1");
  assert.equal(lineage.get("E2-sibling"), "E1");

  const factByRoot = new Map<string, string>();
  const bind = (evidence: string, fact: string) => {
    const root = lineage.get(evidence)!;
    const existing = factByRoot.get(root);
    if (existing && existing !== fact) return false;
    factByRoot.set(root, fact);
    return true;
  };
  assert.equal(bind("E2", "Fact-A"), true); // successor may bind first
  assert.equal(bind("E1", "Fact-B"), false); // reverse-order root attempt
  assert.equal(bind("E2-sibling", "Fact-B"), false);
  assert.equal(bind("E1", "Fact-A"), true);
  assert.equal(bind("E3", "Fact-A"), true);

  const evidenceGuard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(sql, /lineage_root_evidence_id uuid not null/i);
  assert.match(sql, /foreign key \(house_id, lineage_root_evidence_id, employee_id\)/i);
  assert.match(evidenceGuard, /new\.lineage_root_evidence_id := new\.id/i);
  assert.match(evidenceGuard, /new\.lineage_root_evidence_id := v_predecessor_lineage_root_id/i);
  assert.match(evidenceGuard, /new\.lineage_root_evidence_id <> v_predecessor_lineage_root_id/i);

  const membershipGuard = functionSql("hr_guard_attendance_frame_membership_insert", "hr_guard_attendance_fact_revision_segment_insert");
  const rootLock = membershipGuard.indexOf("from public.hr_attendance_evidence lineage_root");
  const historyCheck = membershipGuard.indexOf("from public.hr_attendance_fact_evidence existing");
  assert.ok(rootLock >= 0 && rootLock < historyCheck, "lineage root must lock before immutable membership history is checked");
  assert.match(membershipGuard, /lineage_root\.id = v_lineage_root_evidence_id[\s\S]*for update/i);
  assert.match(membershipGuard, /historical_evidence\.lineage_root_evidence_id = v_lineage_root_evidence_id/i);
  assert.match(membershipGuard, /historical_evidence\.observation_id = v_observation_id/i);
  assert.doesNotMatch(sql, /unique\s*\(house_id, lineage_root_evidence_id\)/i);
});

test("one evidence frame admits at most one member of a lineage while later bases remain exact", () => {
  const members = new Map<string, Set<string>>();
  const add = (basis: number, root: string) => {
    const key = `House|Fact|${basis}`;
    const roots = members.get(key) ?? new Set<string>();
    if (roots.has(root)) return false;
    roots.add(root);
    members.set(key, roots);
    return true;
  };
  assert.equal(add(1, "L1"), true); // root E1
  assert.equal(add(1, "L1"), false); // successor or deep successor
  assert.equal(add(1, "L1"), false); // sibling successor
  assert.equal(add(2, "L1"), true); // later basis may use current successor
  assert.equal(add(1, "L2"), true); // distinct lineage in same frame
  assert.deepEqual([...members.get("House|Fact|1")!].sort(), ["L1", "L2"]);

  const guard = functionSql("hr_guard_attendance_frame_membership_insert", "hr_guard_attendance_fact_revision_segment_insert");
  const rootLock = guard.indexOf("from public.hr_attendance_evidence lineage_root");
  const sameFrameCheck = guard.indexOf("from public.hr_attendance_fact_evidence frame_member");
  assert.ok(rootLock >= 0 && rootLock < sameFrameCheck, "common lineage root must lock before same-frame inspection");
  assert.match(guard, /frame_member\.house_id = new\.house_id[\s\S]*frame_member\.fact_id = new\.fact_id[\s\S]*frame_member\.evidence_basis_revision = new\.evidence_basis_revision[\s\S]*frame_evidence\.lineage_root_evidence_id = v_lineage_root_evidence_id/i);
  assert.match(guard, /only one member of a semantic lineage/i);
  assert.doesNotMatch(sql, /unique\s*\(house_id, lineage_root_evidence_id\)/i);
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
  assert.match(evidenceGuard, /v_predecessor_observation_id is distinct from new\.observation_id[\s\S]*preserve stable observation identity/i);
  assert.doesNotMatch(sql, /unique[^;]*(?:employee_id, work_date|employee_id, occurred_at|occurred_at, employee_id)/i);
  for (const body of [
    functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped"),
    functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global"),
    functionSql("hr_read_canonical_attendance_house_global"),
  ]) {
    assert.match(body, /source_namespace[\s\S]*source_observation_id[\s\S]*extract\(epoch from (?:o\.)?occurred_at\)/i);
  }
});

test("each DEC-019 observation owns one explicitly superseded semantic evidence lineage", () => {
  type Evidence = { id: string; observation: string | null; supersedes: string | null; root: string };
  const evidence: Evidence[] = [];
  const insert = (id: string, observation: string | null, supersedes: string | null, selectedRoot?: string) => {
    const priorForObservation = observation ? evidence.filter((row) => row.observation === observation) : [];
    if (priorForObservation.length > 0 && !supersedes) return false;
    const predecessor = supersedes ? evidence.find((row) => row.id === supersedes) : undefined;
    if (supersedes && (!predecessor || predecessor.observation !== observation)) return false;
    const root = predecessor?.root ?? id;
    if (selectedRoot && selectedRoot !== root) return false;
    if (priorForObservation.some((row) => row.root !== root)) return false;
    evidence.push({ id, observation, supersedes, root });
    return true;
  };
  assert.equal(insert("E1", "O1", null), true);
  assert.equal(insert("E2", "O1", "E1"), true);
  assert.equal(evidence.at(-1)!.root, "E1");
  assert.equal(insert("E3", "O1", null), false);
  assert.equal(insert("E3", "O1", "E2", "other-root"), false);
  assert.equal(insert("Other", "O2", null), true);
  assert.equal(insert("E4", "O1", "Other"), false);
  assert.equal(insert("Manual-root", null, null), true);
  assert.equal(insert("Manual-successor", null, "Manual-root"), true);

  const guard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  const observationLock = guard.indexOf("from public.hr_attendance_observations observation");
  const observationHistory = guard.indexOf("from public.hr_attendance_evidence existing");
  const rootDecision = guard.indexOf("if new.supersedes_evidence_id is not null");
  assert.ok(observationLock >= 0 && observationLock < observationHistory && observationHistory < rootDecision,
    "stable observation must lock before history and root/successor decision");
  assert.match(guard, /observation\.house_id = new\.house_id[\s\S]*observation\.id = new\.observation_id[\s\S]*observation\.employee_id = new\.employee_id[\s\S]*for update/i);
  assert.match(guard, /v_observation_has_evidence and new\.supersedes_evidence_id is null[\s\S]*Later observation evidence must explicitly supersede/i);
  assert.match(guard, /v_predecessor_observation_id is distinct from new\.observation_id/i);
  assert.match(guard, /new\.lineage_root_evidence_id <> v_observation_lineage_root_id/i);
  assert.match(sql, /unique index hr_attendance_evidence_observation_semantic_revision_unique_idx/i);
  assert.match(sql, /only one member of a semantic lineage/i);
  assert.match(sql, /historical_evidence\.lineage_root_evidence_id = v_lineage_root_evidence_id/i);
});

test("observation-backed kiosk successors preserve lane, logical role, and event-time branch", () => {
  type Evidence = {
    observation: string | null; lane: "KIOSK" | "MANUAL_ADMIN" | "BULK_IMPORT";
    kind: "LOGICAL_IN" | "LOGICAL_OUT" | "EXPLICIT_BRANCH"; branch: string | null;
    integrity: "UNRESOLVED" | "ESTABLISHED"; sufficiency: "INSUFFICIENT" | "SUFFICIENT";
  };
  const maySupersede = (prior: Evidence, next: Evidence) => prior.observation === next.observation
    && (prior.observation === null || (prior.lane !== "KIOSK" && next.lane !== "KIOSK")
      || (next.lane === prior.lane && next.kind === prior.kind && next.branch === prior.branch));
  const kioskInA: Evidence = { observation: "O1", lane: "KIOSK", kind: "LOGICAL_IN", branch: "A", integrity: "UNRESOLVED", sufficiency: "INSUFFICIENT" };
  const kioskOutA: Evidence = { ...kioskInA, kind: "LOGICAL_OUT" };

  assert.equal(maySupersede(kioskInA, { ...kioskInA }), true);
  assert.equal(maySupersede(kioskInA, kioskOutA), false);
  assert.equal(maySupersede(kioskOutA, kioskInA), false);
  assert.equal(maySupersede(kioskInA, { ...kioskInA, branch: "B" }), false);
  assert.equal(maySupersede(kioskInA, { ...kioskInA, lane: "MANUAL_ADMIN", kind: "EXPLICIT_BRANCH" }), false);
  const observedManual: Evidence = { ...kioskInA, lane: "MANUAL_ADMIN", kind: "EXPLICIT_BRANCH" };
  const observedBulk: Evidence = { ...kioskInA, lane: "BULK_IMPORT", kind: "EXPLICIT_BRANCH" };
  assert.equal(maySupersede(observedManual, { ...kioskInA }), false);
  assert.equal(maySupersede(observedManual, { ...kioskInA, branch: "B" }), false);
  assert.equal(maySupersede(observedBulk, { ...kioskOutA }), false);
  assert.equal(maySupersede(observedBulk, { ...kioskOutA, branch: "B" }), false);
  assert.equal(maySupersede(kioskInA, { ...kioskInA, integrity: "ESTABLISHED" }), true);
  assert.equal(maySupersede(kioskInA, { ...kioskInA, sufficiency: "SUFFICIENT" }), true);
  assert.equal(maySupersede(kioskInA, { ...kioskInA, observation: "O2", branch: "B" }), false);
  assert.deepEqual([kioskInA, { ...kioskInA, observation: "O2", branch: "B" }].map((row) => row.branch), ["A", "B"]);
  const manual: Evidence = { observation: null, lane: "MANUAL_ADMIN", kind: "EXPLICIT_BRANCH", branch: "A", integrity: "UNRESOLVED", sufficiency: "INSUFFICIENT" };
  assert.equal(maySupersede(manual, { ...manual, branch: "B" }), true);
  const bulk: Evidence = { ...manual, lane: "BULK_IMPORT" };
  assert.equal(maySupersede(bulk, { ...bulk, branch: "B" }), true);

  const guard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(guard, /select predecessor\.observation_id, predecessor\.lineage_root_evidence_id,[\s\S]*predecessor\.lane, predecessor\.evidence_kind, predecessor\.branch_id[\s\S]*for update/i);
  assert.match(guard, /v_predecessor_observation_id is not null\s+and \(v_predecessor_lane = 'KIOSK' or new\.lane = 'KIOSK'\)/i);
  assert.match(guard, /new\.lane is distinct from v_predecessor_lane/i);
  assert.match(guard, /new\.evidence_kind is distinct from v_predecessor_evidence_kind/i);
  assert.match(guard, /new\.branch_id is distinct from v_predecessor_branch_id/i);
  assert.match(guard, /v_predecessor_observation_id is distinct from new\.observation_id/i);
  assert.match(guard, /new\.lineage_root_evidence_id := v_predecessor_lineage_root_id/i);
  assert.doesNotMatch(guard, /new\.(?:integrity_state|sufficiency_state|is_integrity_eligible) is distinct from v_predecessor/i);
});

test("kiosk authority requires a trustworthy stable observation identity and occurrence time", () => {
  assert.match(sql, /constraint hr_attendance_evidence_kiosk_observation_authority_check check[\s\S]*lane <> 'KIOSK'[\s\S]*integrity_state <> 'ESTABLISHED'[\s\S]*sufficiency_state <> 'SUFFICIENT'[\s\S]*observation_id is not null/i);
  assert.match(sql, /source_namespace text not null/i);
  assert.match(sql, /source_observation_id text not null/i);
  assert.match(sql, /occurred_at timestamptz not null/i);
  assert.doesNotMatch(sql, /clientEventId|client_event_id/i);
});

test("established valid explicit provenance requires applicability audit independent of sufficiency", () => {
  type ExplicitEvidence = {
    lane: "MANUAL_ADMIN" | "BULK_IMPORT"; state: "ESTABLISHED" | "UNRESOLVED" | "INVALID";
    reason: "VALID" | "MISSING_INTEGRITY_PROOF" | "INVALID_PROVENANCE"; eligible: boolean;
    sufficient: boolean; namespace: string | null; reference: string | null; assertedAt: string | null;
    actor: string | null; role: string | null;
  };
  const auditComplete = (row: ExplicitEvidence) => Boolean(
    row.namespace?.trim() && row.reference?.trim() && row.assertedAt
      && (row.lane !== "MANUAL_ADMIN" || (row.actor && row.role)),
  );
  const mayStore = (row: ExplicitEvidence) =>
    !(row.state === "ESTABLISHED" && row.reason === "VALID" && row.eligible) || auditComplete(row);
  const manualComplete: ExplicitEvidence = {
    lane: "MANUAL_ADMIN", state: "ESTABLISHED", reason: "VALID", eligible: true,
    sufficient: false, namespace: "admin-command", reference: "case-1",
    assertedAt: "2026-01-01T00:00:00Z", actor: "entity-A", role: "house_owner",
  };
  const bulkComplete: ExplicitEvidence = {
    ...manualComplete, lane: "BULK_IMPORT", namespace: "trusted-import",
    reference: "authorization-1", actor: null, role: null,
  };
  assert.equal(mayStore({ ...manualComplete, namespace: null, reference: null, assertedAt: null, actor: null, role: null }), false);
  assert.equal(mayStore({ ...bulkComplete, namespace: null, reference: null, assertedAt: null }), false);
  assert.equal(mayStore(manualComplete), true);
  assert.equal(mayStore({ ...manualComplete, sufficient: true }), true);
  assert.equal(mayStore(bulkComplete), true);
  assert.equal(mayStore({ ...bulkComplete, sufficient: true }), true);
  assert.equal(mayStore({ ...manualComplete, state: "UNRESOLVED", reason: "MISSING_INTEGRITY_PROOF", eligible: false, namespace: null, reference: null, assertedAt: null, actor: null, role: null }), true);
  assert.equal(mayStore({ ...manualComplete, state: "INVALID", reason: "INVALID_PROVENANCE", eligible: false, namespace: null, reference: null, assertedAt: null, actor: null, role: null }), true);

  const evidenceTable = sql.slice(sql.indexOf("create table public.hr_attendance_evidence ("), sql.indexOf("create unique index hr_attendance_evidence_observation_semantic_revision_unique_idx"));
  assert.match(evidenceTable, /constraint hr_attendance_evidence_explicit_audit_check check[\s\S]*integrity_state = 'ESTABLISHED'[\s\S]*integrity_reason_class = 'VALID'[\s\S]*is_integrity_eligible[\s\S]*authorization_namespace is not null[\s\S]*authorization_reference is not null[\s\S]*asserted_at is not null[\s\S]*asserted_by_entity_id is not null and asserted_by_house_role is not null/i);
  assert.doesNotMatch(evidenceTable.slice(evidenceTable.indexOf("constraint hr_attendance_evidence_explicit_audit_check")), /sufficiency_state = 'SUFFICIENT'/i);
  assert.match(sql, /foreign key \(asserted_by_entity_id\)\s+references public\.entities\(id\)/i);
  const auditGuard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  assert.match(auditGuard, /from public\.house_roles hr[\s\S]*hr\.house_id = new\.house_id[\s\S]*hr\.entity_id = new\.asserted_by_entity_id[\s\S]*lower\(btrim\(hr\.role\)\)[\s\S]*lower\(btrim\(new\.asserted_by_house_role\)\)[\s\S]*for key share/i);
  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  assert.match(rebuild, /explicit_lane_sufficient/i);
  assert.match(rebuild, /e\.authorization_namespace is not null[\s\S]*e\.authorization_reference is not null[\s\S]*e\.asserted_at is not null[\s\S]*e\.lane <> 'MANUAL_ADMIN'[\s\S]*e\.asserted_by_entity_id is not null[\s\S]*e\.asserted_by_house_role is not null/i);
  assert.match(rebuild, /when established_branch_count > 1 then 'CONFLICT'/i);
});

test("all otherwise conflict-applicable manual evidence validates exact-House role at assertion time", () => {
  type AuthorityClass = "OWNER" | "MANAGER";
  const normalizeAuthority = (role: string): AuthorityClass | null => {
    const normalized = role.trim().toLowerCase();
    if (["house_owner", "business_owner"].includes(normalized)) return "OWNER";
    if (["house_manager", "business_admin", "business_manager"].includes(normalized)) return "MANAGER";
    return null;
  };
  const authorized = (storedRole: string, storedHouse: string, assertedRole: string, evidenceHouse = "House-A") => {
    const storedClass = normalizeAuthority(storedRole);
    const assertedClass = normalizeAuthority(assertedRole);
    return storedHouse === evidenceHouse && storedClass !== null && storedClass === assertedClass;
  };
  for (const role of ["house_owner", "HOUSE_OWNER", "business_owner", "BUSINESS_OWNER"])
    assert.equal(authorized(role, "House-A", " house_owner "), true, role);
  for (const role of ["house_manager", "HOUSE_MANAGER", "business_admin", "BUSINESS_ADMIN", "business_manager", "BUSINESS_MANAGER"])
    assert.equal(authorized(role, "House-A", " HOUSE_MANAGER "), true, role);
  for (const role of ["house_staff", "business_staff", "cashier", "game_master", "gm", "arbitrary"])
    assert.equal(authorized(role, "House-A", role), false, role);
  assert.equal(authorized("BUSINESS_OWNER", "House-B", "house_owner"), false);
  assert.equal(authorized("house_staff", "House-A", "house_owner"), false);
  assert.equal(authorized("house_owner", "House-A", "house_manager"), false);
  assert.equal(authorized("business_admin", "House-A", "house_owner"), false);

  const guard = functionSql("hr_guard_attendance_evidence_insert", "hr_guard_attendance_frame_membership_insert");
  const manualCondition = guard.slice(guard.indexOf("if new.lane = 'MANUAL_ADMIN'"), guard.indexOf("perform 1 from public.house_roles"));
  for (const prerequisite of [
    /new\.evidence_kind = 'EXPLICIT_BRANCH'/,
    /new\.integrity_state = 'ESTABLISHED'/,
    /new\.is_integrity_eligible/,
    /new\.branch_id is not null/,
    /length\(btrim\(new\.authorization_namespace\)\) > 0/,
    /length\(btrim\(new\.authorization_reference\)\) > 0/,
    /new\.asserted_at is not null/,
    /new\.asserted_by_entity_id is not null/,
    /new\.asserted_by_house_role is not null/,
  ]) assert.match(manualCondition, prerequisite);
  assert.doesNotMatch(manualCondition, /sufficiency_state/i);
  assert.match(guard, /hr\.house_id = new\.house_id[\s\S]*hr\.entity_id = new\.asserted_by_entity_id/i);
  assert.match(guard, /lower\(btrim\(hr\.role\)\) in \('house_owner', 'business_owner'\) then 'OWNER'/i);
  assert.match(guard, /lower\(btrim\(hr\.role\)\) in \(\s*'house_manager', 'business_admin', 'business_manager'\s*\) then 'MANAGER'/i);
  assert.match(guard, /lower\(btrim\(new\.asserted_by_house_role\)\) in \([\s\S]*'house_owner', 'business_owner'[\s\S]*then 'OWNER'/i);
  assert.match(guard, /lower\(btrim\(new\.asserted_by_house_role\)\) in \([\s\S]*'house_manager', 'business_admin', 'business_manager'[\s\S]*then 'MANAGER'/i);
  assert.doesNotMatch(guard, /entity_policies|scope = 'PLATFORM'|scope = 'GUILD'|current_entity_is_gm/i);

  const completeButInsufficient = { completeAudit: true, sufficient: false, roleExistsInHouse: true };
  assert.equal(completeButInsufficient.completeAudit && completeButInsufficient.roleExistsInHouse, true);
  assert.equal(completeButInsufficient.sufficient, false);
  const malformedHistory = { completeAudit: false, roleLookupRequired: false, conflictApplicable: false };
  assert.equal(malformedHistory.roleLookupRequired, false);
  assert.equal(malformedHistory.conflictApplicable, false);
});

test("conflict aggregation excludes unaudited explicit rows without collapsing applicability into sufficiency", () => {
  type BranchEvidence = {
    lane: "KIOSK" | "MANUAL_ADMIN" | "BULK_IMPORT";
    branch: string;
    established: boolean;
    eligible: boolean;
    audited: boolean;
    sufficient: boolean;
  };
  const classify = (rows: BranchEvidence[], kioskSufficient: boolean) => {
    const applicable = rows.filter((row) => row.established && row.eligible && (
      row.lane === "KIOSK" || row.audited
    ));
    const branches = new Set(applicable.map((row) => row.branch));
    if (branches.size > 1) return "CONFLICT";
    const explicitSufficient = applicable.some((row) => row.lane !== "KIOSK" && row.sufficient);
    return branches.size === 1 && (kioskSufficient || explicitSufficient) ? "ATTRIBUTED" : "UNATTRIBUTED";
  };
  const kioskA = { lane: "KIOSK", branch: "A", established: true, eligible: true, audited: false, sufficient: true } as const;
  const explicit = (lane: "MANUAL_ADMIN" | "BULK_IMPORT", branch: string, audited: boolean, sufficient: boolean): BranchEvidence =>
    ({ lane, branch, established: true, eligible: true, audited, sufficient });

  assert.equal(classify([kioskA, explicit("MANUAL_ADMIN", "B", false, false)], true), "ATTRIBUTED");
  assert.equal(classify([kioskA, explicit("BULK_IMPORT", "B", false, false)], true), "ATTRIBUTED");
  assert.equal(classify([kioskA, explicit("MANUAL_ADMIN", "B", true, false)], true), "CONFLICT");
  assert.equal(classify([kioskA, explicit("MANUAL_ADMIN", "A", true, false)], true), "ATTRIBUTED");
  assert.equal(classify([explicit("MANUAL_ADMIN", "B", false, false)], false), "UNATTRIBUTED");
  assert.equal(classify([explicit("MANUAL_ADMIN", "A", true, false), explicit("BULK_IMPORT", "B", true, false)], false), "CONFLICT");

  const rebuild = functionSql("hr_rebuild_attendance_authorization_projection", "hr_read_canonical_attendance_branch_scoped");
  const aggregate = rebuild.slice(rebuild.indexOf("aggregate_frame as"), rebuild.indexOf("classified as"));
  assert.match(rebuild, /end as conflict_branch_applicable/i);
  assert.equal((aggregate.match(/where conflict_branch_applicable/g) ?? []).length, 2);
  assert.match(aggregate, /count\(distinct branch_id\) filter \(\s*where conflict_branch_applicable\s*\) as established_branch_count/i);
  assert.match(aggregate, /array_agg\(distinct branch_id order by branch_id\) filter \(\s*where conflict_branch_applicable\s*\)/i);
  assert.match(aggregate, /conflict_branch_applicable\s+and lane in \('MANUAL_ADMIN', 'BULK_IMPORT'\)\s+and sufficiency_state = 'SUFFICIENT'[\s\S]*as explicit_lane_sufficient/i);
  assert.match(rebuild, /coalesce\(array_agg\(evidence_id[\s\S]*as evidence_ids/i);
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
  for (const shape of [branchShape, globalShape]) assert.doesNotMatch(shape, /value_revision|evidence_basis|fingerprint|generation|evidence_id|integrity_reason_class/i);
  assert.match(branchShape, /active_branch_id uuid/i);
  assert.match(globalShape, /attribution_state text/i);
});

test("effective PLATFORM feature grants are honored independently of their role source", () => {
  type Policy = { scope: "PLATFORM" | "HOUSE" | "GUILD"; scopeRef?: string; roleSlug: string };
  const requestedHouse = "House-A";
  const featureAllowed = (policy: Policy) => policy.scope === "PLATFORM"
    || (policy.scope === "HOUSE" && policy.scopeRef === requestedHouse);
  const branchRowsVisible = (policy: Policy, hasMembership: boolean, branchHouse?: string) =>
    featureAllowed(policy) && hasMembership && branchHouse === requestedHouse;

  assert.equal(branchRowsVisible({ scope: "PLATFORM", roleSlug: "direct" }, true, requestedHouse), true);
  assert.equal(branchRowsVisible({ scope: "PLATFORM", roleSlug: "game_master" }, true, requestedHouse), true);
  assert.equal(branchRowsVisible({ scope: "PLATFORM", roleSlug: "arbitrary_platform_role" }, true, requestedHouse), true);
  assert.equal(branchRowsVisible({ scope: "HOUSE", scopeRef: requestedHouse, roleSlug: "house_staff" }, true, requestedHouse), true);
  assert.equal(branchRowsVisible({ scope: "HOUSE", scopeRef: "House-B", roleSlug: "house_staff" }, true, requestedHouse), false);
  assert.equal(branchRowsVisible({ scope: "GUILD", scopeRef: "Guild-A", roleSlug: "guild_role" }, true, requestedHouse), false);
  assert.equal(branchRowsVisible({ scope: "PLATFORM", roleSlug: "game_master" }, false, requestedHouse), false);
  assert.equal(branchRowsVisible({ scope: "PLATFORM", roleSlug: "game_master" }, true), false);
  assert.equal(branchRowsVisible({ scope: "PLATFORM", roleSlug: "game_master" }, true, "House-B"), false);

  const branch = functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global");
  const featureBlock = branch.slice(branch.indexOf("effective_feature_read"), branch.indexOf("allowed_branches"));
  assert.match(featureBlock, /from public\.entity_policies ep[\s\S]*ep\.policy_key in \('tiles\.hr\.read', 'tiles\.payroll\.read'\)/i);
  assert.match(featureBlock, /ep\.scope = 'PLATFORM'\s+or \(ep\.scope = 'HOUSE' and ep\.scope_ref = p_house_id\)/i);
  assert.doesNotMatch(featureBlock, /role_slug|scope = 'GUILD'/i);
  assert.match(featureBlock, /ep\.scope = 'HOUSE' and ep\.scope_ref = p_house_id/i);
  assert.match(branch, /from public\.house_roles hr[\s\S]*hr\.house_id = p_house_id/i);
  const branchBlock = branch.slice(branch.indexOf("allowed_branches"));
  assert.match(branchBlock, /ep\.scope = 'HOUSE' and ep\.scope_ref = p_house_id/i);
  assert.match(branch, /join public\.branches b on b\.house_id = p_house_id and b\.id = parsed\.id/i);
});

test("wrong-House role feature grants cannot combine with requested-House membership", () => {
  const branch = functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global");
  const featureBlock = branch.slice(branch.indexOf("effective_feature_read"), branch.indexOf("allowed_branches"));
  assert.match(featureBlock, /ep\.scope = 'PLATFORM'\s+or \(ep\.scope = 'HOUSE' and ep\.scope_ref = p_house_id\)/i);
  assert.doesNotMatch(featureBlock, /ep\.scope = 'HOUSE'\s*\)/i);
});

test("zero or cross-House branch scope returns no branch rows", () => {
  const branch = functionSql("hr_read_canonical_attendance_branch_scoped", "hr_read_canonical_attendance_house_global");
  assert.match(branch, /join allowed_branches ab on ab\.id = p\.active_branch_id/i);
  assert.match(branch, /join public\.branches b on b\.house_id = p_house_id/i);
  assert.doesNotMatch(branch, /left join allowed_branches/i);
});

test("owner and manager global authority remains exact-House and separate", () => {
  const accepted = new Set(["house_owner", "business_owner", "house_manager", "business_admin", "business_manager"]);
  const authorized = (role: string, roleHouse: string, requestedHouse = "House-A") =>
    roleHouse === requestedHouse && accepted.has(role.trim().toLowerCase());
  for (const role of [
    "house_owner", "HOUSE_OWNER", "business_owner", "BUSINESS_OWNER",
    "house_manager", "HOUSE_MANAGER", "business_admin", "BUSINESS_ADMIN",
    "business_manager", "BUSINESS_MANAGER",
  ]) assert.equal(authorized(role, "House-A"), true, role);
  for (const role of ["house_staff", "business_staff", "cashier", "game_master", "gm", "arbitrary"])
    assert.equal(authorized(role, "House-A"), false, role);
  assert.equal(authorized("BUSINESS_OWNER", "House-B"), false);
  assert.equal(authorized("BUSINESS_MANAGER", "House-B"), false);

  const global = functionSql("hr_read_canonical_attendance_house_global");
  assert.match(global, /hr\.house_id = p_house_id/i);
  assert.match(global, /hr\.entity_id = public\.current_entity_id\(\)/i);
  assert.match(global, /lower\(btrim\(hr\.role\)\) in \(\s*'house_owner', 'business_owner', 'house_manager',\s*'business_admin', 'business_manager'\s*\)/i);
  assert.doesNotMatch(global, /entity_policies|current_entity_is_gm|scope = 'PLATFORM'|allowed_branches/i);
  assert.match(sql, /comment on function public\.hr_read_canonical_attendance_house_global\(uuid, date, date, uuid, integer, integer\) is\s+'GAP-024 Gate A sanitized house-global reader restricted to established normalized exact-House owner\/manager aliases\.'/i);
  assert.doesNotMatch(sql, /house-global reader restricted to house_owner\/house_manager membership/i);
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


test("live-policy compatibility migration keeps branch authorization on canonical current tables", () => {
  const branch = compatibilityFunctionSql("hr_read_canonical_attendance_branch_scoped");

  assert.match(branch, /join public\.entity_policies ep on ep\.entity_id = hm\.entity_id/i);
  assert.match(branch, /join public\.policies p on p\.id = ep\.policy_id/i);
  assert.doesNotMatch(branch, /ep\.policy_key|ep\.scope|ep\.scope_ref/i);

  assert.match(branch, /join public\.house_roles hr[\s\S]*hr\.house_id = p_house_id[\s\S]*hr\.entity_id = hm\.entity_id/i);
  assert.match(branch, /join public\.role_policies rp on rp\.role_id = r\.id[\s\S]*join public\.policies p on p\.id = rp\.policy_id/i);
  assert.match(branch, /to_jsonb\(hr\)\s*->>\s*'role_id'/i);
  assert.match(branch, /to_jsonb\(r\)\s*->>\s*'slug'/i);
  assert.match(branch, /to_jsonb\(r\)\s*->>\s*'key'/i);

  assert.match(branch, /join public\.platform_roles pr on pr\.entity_id = hm\.entity_id/i);
  assert.match(branch, /cross join lateral unnest\(pr\.roles\)/i);
  assert.match(branch, /effective_policy\.policy_key in \('tiles\.hr\.read', 'tiles\.payroll\.read'\)/i);

  const allowedBranches = branch.slice(branch.indexOf("allowed_branches as ("));
  assert.match(allowedBranches, /join house_policy_keys hpk on hpk\.entity_id = afr\.entity_id/i);
  assert.doesNotMatch(allowedBranches, /join direct_policy_keys|join platform_policy_keys/i);
  assert.match(allowedBranches, /b\.house_id = p_house_id[\s\S]*b\.id = parsed\.id/i);

  assert.match(branch, /lower\(btrim\(hr\.role\)\) in \([\s\S]*'house_owner'[\s\S]*'business_owner'[\s\S]*'house_manager'[\s\S]*'business_admin'[\s\S]*'business_manager'/i);
  assert.match(compatibilitySql, /revoke all on function public\.hr_read_canonical_attendance_branch_scoped\([\s\S]*from public, anon/i);
  assert.match(compatibilitySql, /grant execute on function public\.hr_read_canonical_attendance_branch_scoped\([\s\S]*to authenticated/i);
  assert.match(compatibilitySql, /notify pgrst, 'reload schema'/i);

  assert.doesNotMatch(compatibilitySql, /drop\s+(?:table|view)\s+public\.entity_policies/i);
  assert.doesNotMatch(compatibilitySql, /create\s+(?:table|view)\s+public\.entity_policies/i);
  assert.doesNotMatch(compatibilitySql, /insert\s+into\s+public\.(?:policies|roles|role_policies|house_roles|entity_policies|platform_roles)/i);
});


test("policy replay guard keeps scope-less live direct grants global but historical flattened grants PLATFORM-only", () => {
  const branchStart = replayGuardSql.indexOf("create or replace function public.hr_read_canonical_attendance_branch_scoped");
  assert.notEqual(branchStart, -1);
  const branch = replayGuardSql.slice(branchStart);

  const directBlock = branch.slice(branch.indexOf("direct_policy_keys as ("), branch.indexOf("platform_policy_keys as ("));
  assert.match(directBlock, /join public\.entity_policies ep on ep\.entity_id = hm\.entity_id/i);
  assert.match(directBlock, /join public\.policies p on p\.id = ep\.policy_id/i);
  assert.match(directBlock, /not \(to_jsonb\(ep\) \? 'scope'\)/i);
  assert.match(directBlock, /upper\(btrim\(coalesce\(to_jsonb\(ep\) ->> 'scope', ''\)\)\) = 'PLATFORM'/i);
  assert.doesNotMatch(directBlock, /scope_ref/i);

  const allowedBranches = branch.slice(branch.indexOf("allowed_branches as ("));
  assert.match(allowedBranches, /join house_policy_keys hpk on hpk\.entity_id = afr\.entity_id/i);
  assert.doesNotMatch(allowedBranches, /join direct_policy_keys|join platform_policy_keys/i);
  assert.match(allowedBranches, /b\.house_id = p_house_id[\s\S]*b\.id = parsed\.id/i);

  assert.match(branch, /effective_policy\.policy_key in \('tiles\.hr\.read', 'tiles\.payroll\.read'\)/i);
  assert.match(branch, /from public\.house_roles hr[\s\S]*hr\.house_id = p_house_id[\s\S]*hr\.entity_id = a\.entity_id/i);
  assert.match(branch, /lower\(btrim\(hr\.role\)\) in \([\s\S]*'house_owner'[\s\S]*'business_owner'[\s\S]*'house_manager'[\s\S]*'business_admin'[\s\S]*'business_manager'/i);

  assert.doesNotMatch(replayGuardSql, /drop\s+(?:table|view)\s+public\.entity_policies/i);
  assert.doesNotMatch(replayGuardSql, /create\s+(?:table|view)\s+public\.entity_policies/i);
  assert.match(replayGuardSql, /revoke all on function public\.hr_read_canonical_attendance_branch_scoped\([\s\S]*from public, anon/i);
  assert.match(replayGuardSql, /grant execute on function public\.hr_read_canonical_attendance_branch_scoped\([\s\S]*to authenticated/i);
  assert.match(replayGuardSql, /notify pgrst, 'reload schema'/i);
});


test("role-scope guard prevents cross-scope and cross-House policy inheritance", () => {
  const branchStart = roleScopeGuardSql.indexOf("create or replace function public.hr_read_canonical_attendance_branch_scoped");
  assert.notEqual(branchStart, -1);
  const branch = roleScopeGuardSql.slice(branchStart);

  const platformBlock = branch.slice(branch.indexOf("platform_policy_keys as ("), branch.indexOf("house_policy_keys as ("));
  assert.match(platformBlock, /to_jsonb\(r\) \? 'scope_ref'/i);
  assert.match(platformBlock, /upper\(btrim\(coalesce\(to_jsonb\(r\) ->> 'scope', ''\)\)\) = 'PLATFORM'/i);
  assert.match(platformBlock, /nullif\(to_jsonb\(r\) ->> 'scope_ref', ''\) is null/i);
  assert.match(platformBlock, /not \(to_jsonb\(r\) \? 'scope_ref'\)[\s\S]*lower\(btrim\(to_jsonb\(r\) ->> 'scope'\)\) = 'platform'/i);

  const houseBlock = branch.slice(branch.indexOf("house_policy_keys as ("), branch.indexOf("effective_feature_read as ("));
  assert.match(houseBlock, /to_jsonb\(hr\) ->> 'role_id'/i);
  assert.match(houseBlock, /to_jsonb\(r\) ->> 'slug'/i);
  assert.match(houseBlock, /to_jsonb\(r\) ->> 'key'/i);
  assert.match(houseBlock, /to_jsonb\(r\) \? 'scope_ref'/i);
  assert.match(houseBlock, /upper\(btrim\(coalesce\(to_jsonb\(r\) ->> 'scope', ''\)\)\) = 'HOUSE'/i);
  assert.match(houseBlock, /nullif\(to_jsonb\(r\) ->> 'scope_ref', ''\) is null[\s\S]*or \(to_jsonb\(r\) ->> 'scope_ref'\)::uuid = p_house_id/i);
  assert.match(houseBlock, /not \(to_jsonb\(r\) \? 'scope_ref'\)[\s\S]*lower\(btrim\(to_jsonb\(r\) ->> 'scope'\)\) in \('house', 'workspace'\)/i);

  const allowedBranches = branch.slice(branch.indexOf("allowed_branches as ("));
  assert.match(allowedBranches, /join house_policy_keys hpk on hpk\.entity_id = afr\.entity_id/i);
  assert.doesNotMatch(allowedBranches, /join direct_policy_keys|join platform_policy_keys/i);
  assert.match(allowedBranches, /b\.house_id = p_house_id[\s\S]*b\.id = parsed\.id/i);

  assert.doesNotMatch(roleScopeGuardSql, /drop\s+(?:table|view)\s+public\.(?:roles|house_roles|platform_roles)/i);
  assert.doesNotMatch(roleScopeGuardSql, /insert\s+into\s+public\.(?:roles|house_roles|platform_roles)/i);
  assert.match(roleScopeGuardSql, /notify pgrst, 'reload schema'/i);
});


test("supersession lookup index matches activation and sealing successor probes", () => {
  assert.match(
    supersessionIndexSql,
    /create index if not exists hr_attendance_evidence_supersession_lookup_idx\s+on public\.hr_attendance_evidence \(\s*house_id,\s*supersedes_evidence_id,\s*employee_id,\s*lineage_root_evidence_id\s*\)\s*where supersedes_evidence_id is not null;/is,
  );

  const activationStart = sql.indexOf("create or replace function public.hr_guard_attendance_fact_activation");
  assert.notEqual(activationStart, -1);
  const activation = sql.slice(
    activationStart,
    sql.indexOf("create or replace function", activationStart + 1),
  );
  assert.match(
    activation,
    /successor\.house_id\s*=\s*target_evidence\.house_id[\s\S]*successor\.employee_id\s*=\s*target_evidence\.employee_id[\s\S]*successor\.lineage_root_evidence_id\s*=\s*target_evidence\.lineage_root_evidence_id[\s\S]*successor\.supersedes_evidence_id\s*=\s*target_evidence\.id/i,
  );

  const frameStart = sql.indexOf("create or replace function public.hr_guard_attendance_evidence_frame");
  assert.notEqual(frameStart, -1);
  const frame = sql.slice(
    frameStart,
    sql.indexOf("create or replace function", frameStart + 1),
  );
  assert.match(
    frame,
    /successor\.house_id\s*=\s*selected_evidence\.house_id[\s\S]*successor\.employee_id\s*=\s*selected_evidence\.employee_id[\s\S]*successor\.lineage_root_evidence_id\s*=\s*selected_evidence\.lineage_root_evidence_id[\s\S]*successor\.supersedes_evidence_id\s*=\s*selected_evidence\.id/i,
  );
});


test("historical authorization projection revisions are append-only and keyed by governing pair", () => {
  assert.match(
    projectionHistorySql,
    /create table public\.hr_attendance_authorization_history \([\s\S]*primary key \(house_id, fact_id, value_revision, evidence_basis_revision\)/i,
  );
  assert.match(
    projectionHistorySql,
    /foreign key \(house_id, fact_id, value_revision\)[\s\S]*references public\.hr_attendance_fact_revisions\(house_id, fact_id, revision\)/i,
  );
  assert.match(
    projectionHistorySql,
    /foreign key \(house_id, fact_id, evidence_basis_revision\)[\s\S]*references public\.hr_attendance_evidence_frames\(house_id, fact_id, evidence_basis_revision\)/i,
  );
  assert.match(
    projectionHistorySql,
    /create trigger hr_attendance_authorization_history_immutable[\s\S]*before update or delete[\s\S]*hr_reject_attendance_history_mutation/i,
  );
  assert.match(
    projectionHistorySql,
    /alter table public\.hr_attendance_authorization_history enable row level security/i,
  );
  assert.match(
    projectionHistorySql,
    /revoke all on table public\.hr_attendance_authorization_history[\s\S]*from public, anon, authenticated, service_role/i,
  );
});

test("projection rebuild preserves prior current state before replacement and records the rebuilt pair", () => {
  const fnStart = projectionHistorySql.indexOf(
    "create or replace function public.hr_rebuild_attendance_authorization_projection",
  );
  assert.notEqual(fnStart, -1);
  const fn = projectionHistorySql.slice(fnStart);

  const preserveIndex = fn.indexOf("insert into public.hr_attendance_authorization_history");
  const deleteIndex = fn.indexOf("delete from public.hr_attendance_authorization_projection");
  assert.ok(preserveIndex >= 0 && deleteIndex > preserveIndex);

  assert.match(
    fn,
    /select[\s\S]*p\.value_revision, p\.evidence_basis_revision[\s\S]*p\.attribution_state[\s\S]*from public\.hr_attendance_authorization_projection p[\s\S]*on conflict \(house_id, fact_id, value_revision, evidence_basis_revision\) do nothing/i,
  );

  const classifiedHistoryIndex = fn.indexOf("), history_write as (");
  const currentInsertIndex = fn.indexOf("insert into public.hr_attendance_authorization_projection");
  assert.ok(classifiedHistoryIndex >= 0 && currentInsertIndex > classifiedHistoryIndex);

  assert.match(
    fn.slice(classifiedHistoryIndex),
    /insert into public\.hr_attendance_authorization_history[\s\S]*current_value_revision, evidence_basis_revision[\s\S]*basis_fingerprint, classification[\s\S]*evidence_ids, now\(\)[\s\S]*on conflict \(house_id, fact_id, value_revision, evidence_basis_revision\) do nothing/i,
  );
});

test("projection history is audit-only and does not widen public reader contracts", () => {
  assert.doesNotMatch(
    projectionHistorySql,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]*hr_attendance_authorization_history[\s\S]*to\s+(?:anon|authenticated)/i,
  );
  assert.doesNotMatch(
    projectionHistorySql,
    /create or replace function public\.hr_read_canonical_attendance_(?:branch_scoped|house_global)/i,
  );
  assert.match(projectionHistorySql, /notify pgrst, 'reload schema'/i);
});


test("activation/history guard requires the previously current authority pair to be classified before another change", () => {
  const fnStart = activationHistoryGuardSql.indexOf(
    "create or replace function public.hr_guard_attendance_fact_activation",
  );
  assert.notEqual(fnStart, -1);
  const fn = activationHistoryGuardSql.slice(fnStart);

  assert.match(
    fn,
    /new\.current_value_revision is distinct from old\.current_value_revision[\s\S]*new\.evidence_basis_revision is distinct from old\.evidence_basis_revision[\s\S]*new\.is_active is distinct from old\.is_active/i,
  );
  assert.match(
    fn,
    /from public\.hr_attendance_authorization_history h[\s\S]*h\.house_id = old\.house_id[\s\S]*h\.fact_id = old\.id[\s\S]*h\.employee_id = old\.employee_id[\s\S]*h\.value_revision = old\.current_value_revision[\s\S]*h\.evidence_basis_revision = old\.evidence_basis_revision/i,
  );
  assert.match(
    fn,
    /raise exception 'Current attendance authority pair must be classified before another authority change'/i,
  );

  const historyGuardIndex = fn.indexOf("from public.hr_attendance_authorization_history h");
  const forwardRevisionIndex = fn.indexOf("if new.current_value_revision < old.current_value_revision");
  assert.ok(historyGuardIndex >= 0 && forwardRevisionIndex > historyGuardIndex);

  assert.doesNotMatch(
    activationHistoryGuardSql,
    /insert\s+into\s+public\.hr_attendance_authorization_history/i,
  );
  assert.doesNotMatch(
    activationHistoryGuardSql,
    /create or replace function public\.hr_rebuild_attendance_authorization_projection/i,
  );
});


test("activation history guard reads protected history through a narrowly scoped security-definer trigger", () => {
  assert.match(
    activationHistoryPrivilegeSql,
    /alter function public\.hr_guard_attendance_fact_activation\(\)\s+security definer;/i,
  );
  assert.match(
    activationHistoryPrivilegeSql,
    /alter function public\.hr_guard_attendance_fact_activation\(\)\s+set search_path = pg_catalog, public;/i,
  );
  assert.match(
    activationHistoryPrivilegeSql,
    /revoke all on function public\.hr_guard_attendance_fact_activation\(\)\s+from public, anon, authenticated, service_role;/i,
  );
  assert.doesNotMatch(
    activationHistoryPrivilegeSql,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]*hr_attendance_authorization_history/i,
  );
  assert.doesNotMatch(
    activationHistoryPrivilegeSql,
    /grant\s+execute\s+on function public\.hr_guard_attendance_fact_activation\(\)/i,
  );
  assert.doesNotMatch(
    activationHistoryPrivilegeSql,
    /alter table public\.hr_attendance_authorization_history\s+disable row level security/i,
  );
});


test("retired facts freeze authority pointers across and after retirement", () => {
  const fnStart = retiredFactPointerFreezeSql.indexOf(
    "create or replace function public.hr_guard_attendance_fact_activation",
  );
  assert.notEqual(fnStart, -1);
  const fn = retiredFactPointerFreezeSql.slice(fnStart);

  assert.match(
    fn,
    /\(not old\.is_active or not new\.is_active\)[\s\S]*new\.current_value_revision is distinct from old\.current_value_revision[\s\S]*new\.evidence_basis_revision is distinct from old\.evidence_basis_revision/i,
  );
  assert.match(
    fn,
    /raise exception 'Retired canonical attendance fact authority pointers are immutable'/i,
  );

  const resurrectionIndex = fn.indexOf("if not old.is_active and new.is_active");
  const freezeIndex = fn.indexOf("Retired canonical attendance fact authority pointers are immutable");
  const historyIndex = fn.indexOf("from public.hr_attendance_authorization_history h");
  assert.ok(resurrectionIndex >= 0 && freezeIndex > resurrectionIndex && historyIndex > freezeIndex);

  assert.match(
    retiredFactPointerFreezeSql,
    /language plpgsql[\s\S]*security definer[\s\S]*set search_path = pg_catalog, public/i,
  );
  assert.match(
    retiredFactPointerFreezeSql,
    /revoke all on function public\.hr_guard_attendance_fact_activation\(\)[\s\S]*from public, anon, authenticated, service_role/i,
  );
});

test("retirement may only tombstone the already-current authority pair", () => {
  const retiredTransitionAllowed = (
    oldActive: boolean,
    newActive: boolean,
    oldValue: number,
    newValue: number,
    oldBasis: number,
    newBasis: number,
  ) =>
    !((!oldActive || !newActive) && (oldValue !== newValue || oldBasis !== newBasis))
    && !(oldActive === false && newActive === true);

  assert.equal(retiredTransitionAllowed(true, false, 4, 4, 6, 6), true);
  assert.equal(retiredTransitionAllowed(false, false, 4, 5, 6, 6), false);
  assert.equal(retiredTransitionAllowed(false, false, 4, 4, 6, 7), false);
  assert.equal(retiredTransitionAllowed(true, false, 4, 5, 6, 6), false);
  assert.equal(retiredTransitionAllowed(true, false, 4, 4, 6, 7), false);
  assert.equal(retiredTransitionAllowed(false, true, 4, 4, 6, 6), false);
});
