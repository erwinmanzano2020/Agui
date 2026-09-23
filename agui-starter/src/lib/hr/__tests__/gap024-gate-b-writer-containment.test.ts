import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function repoFile(relativePath: string) {
  const path = [
    resolve(process.cwd(), "..", relativePath),
    resolve(process.cwd(), "../..", relativePath),
  ].find(existsSync);
  assert.ok(path, `Missing repository file: ${relativePath}`);
  return readFileSync(path, "utf8");
}

const bulkSql = repoFile(
  "supabase/migrations/20261020130000_gap024_gate_b_bulk_command.sql",
);
const repairSql = repoFile(
  "supabase/migrations/20261020140000_gap024_gate_b_repair_command.sql",
);
const cutoverSql = repoFile(
  "supabase/migrations/20261020150000_gap024_gate_b_reconcile_cutover.sql",
);
const bulkRoute = repoFile(
  "agui-starter/src/app/api/payroll/dtr-bulk/route.ts",
);
const bulkClient = repoFile(
  "agui-starter/src/app/payroll/dtr-bulk/DtrBulkClient.tsx",
);
const dtrToday = repoFile(
  "agui-starter/src/app/payroll/dtr-today/page.client.tsx",
);
const repairScript = repoFile(
  "agui-starter/scripts/fix-dtr-timezone.ts",
);

test("bulk replacement is authenticated, idempotent, canonical, and atomic with dtr_entries", () => {
  assert.match(
    bulkSql,
    /create or replace function public\.hr_replace_bulk_attendance_day[\s\S]*security definer/i,
  );
  assert.match(bulkSql, /v_entity_id := public\.current_entity_id\(\)/i);
  assert.match(bulkSql, /'BULK_IMPORT_V1'/i);
  assert.match(
    bulkSql,
    /hr_attendance_mutation_operations[\s\S]*request_fingerprint[\s\S]*on conflict/i,
  );
  assert.match(
    bulkSql,
    /update public\.hr_attendance_facts[\s\S]*set is_active = false/i,
  );
  assert.match(
    bulkSql,
    /insert into public\.hr_attendance_evidence_frames[\s\S]*'COMPLETED'[\s\S]*true/i,
  );
  assert.doesNotMatch(
    bulkSql,
    /insert into public\.hr_attendance_evidence[\s\S]*BULK_IMPORT/i,
  );
  assert.match(
    bulkSql,
    /insert into public\.dtr_entries[\s\S]*on conflict \(employee_id, work_date\)/i,
  );
  assert.match(
    bulkSql,
    /grant execute on function public\.hr_replace_bulk_attendance_day[\s\S]*to authenticated/i,
  );
});

test("active bulk segment replacement no longer uses service-role raw dtr_segments DML", () => {
  assert.match(bulkRoute, /supabase\.rpc\([\s\S]*"hr_replace_bulk_attendance_day"/i);
  assert.doesNotMatch(
    bulkRoute,
    /service[\s\S]{0,120}\.from\("dtr_segments"\)[\s\S]{0,80}\.(insert|update|delete)\(/i,
  );
  assert.doesNotMatch(
    bulkRoute,
    /\.from\("dtr_segments"\)[\s\S]{0,80}\.(insert|update|delete)\(/i,
  );
});

test("bulk operation IDs survive retry but rotate after confirmed success", () => {
  assert.match(bulkClient, /saveOperationIdsRef = useRef\(new Map<string, string>\(\)\)/i);
  assert.match(bulkClient, /const existing = saveOperationIdsRef\.current\.get\(fingerprint\)/i);
  assert.match(bulkClient, /crypto\.randomUUID\(\)/i);
  assert.match(
    bulkClient,
    /if \(!response\.ok\)[\s\S]*throw new Error[\s\S]*saveOperationIdsRef\.current\.clear\(\)[\s\S]*Saved!/i,
  );
});

test("legacy browser attendance writers are retired", () => {
  assert.doesNotMatch(
    dtrToday,
    /\.from\("dtr_segments"\)[\s\S]{0,80}\.(insert|update|delete)\(/i,
  );

  const legacyPageCandidates = [
    resolve(process.cwd(), "../agui-starter/src/app/payroll/dtr-bulk/page2.tsx"),
    resolve(process.cwd(), "../../agui-starter/src/app/payroll/dtr-bulk/page2.tsx"),
  ];
  assert.equal(
    legacyPageCandidates.some(existsSync),
    false,
    "unrouted page2 raw writer must stay retired",
  );
});

test("repair path is canonical, reason-attributed, and unavailable to app roles", () => {
  assert.match(
    repairSql,
    /create or replace function public\.hr_apply_attendance_time_repair/i,
  );
  assert.match(repairSql, /'MAINTENANCE_REPAIR_V1'/i);
  assert.match(repairSql, /'repairReason'/i);
  assert.match(
    repairSql,
    /revoke all on function public\.hr_apply_attendance_time_repair[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.doesNotMatch(
    repairSql,
    /grant execute on function public\.hr_apply_attendance_time_repair/i,
  );
  assert.doesNotMatch(repairScript, /\n\s*UPDATE\s+public?\.?dtr_segments\b/i);
  assert.match(repairScript, /hr_apply_attendance_time_repair/i);
});

test("cutover reconciles every row, constrains kiosk establishment, and removes raw mutation privileges", () => {
  assert.match(cutoverSql, /lock table public\.dtr_segments in share row exclusive mode/i);
  assert.match(
    cutoverSql,
    /where segment\.canonical_fact_id is null[\s\S]*hr_attendance_bootstrap_unattributed_segment/i,
  );
  assert.match(cutoverSql, /metadata ->> 'clientId'/i);
  assert.match(cutoverSql, /v_unique_source_count = v_total_count/i);
  assert.match(cutoverSql, /v_device_context_count = v_total_count/i);
  assert.match(cutoverSql, /v_branch_count = 1/i);
  assert.match(cutoverSql, /v_timestamp_match_count = v_total_count/i);
  assert.match(
    cutoverSql,
    /if exists \([\s\S]*canonical_fact_id is null[\s\S]*raise exception 'Gate-B cutover requires every compatibility row/i,
  );
  assert.match(cutoverSql, /drop policy if exists dtr_segments_insert_authenticated/i);
  assert.match(cutoverSql, /drop policy if exists dtr_segments_update_house_roles/i);
  assert.match(
    cutoverSql,
    /revoke insert, update, delete, truncate, references, trigger[\s\S]*from authenticated/i,
  );
  assert.match(
    cutoverSql,
    /revoke insert, update, delete, truncate, references, trigger[\s\S]*from service_role/i,
  );
});
