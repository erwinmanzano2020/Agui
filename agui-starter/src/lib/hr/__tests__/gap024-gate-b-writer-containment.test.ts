import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
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
const dbTypes = repoFile("agui-starter/src/lib/db.types.ts");
const repairScript = repoFile(
  "agui-starter/scripts/fix-dtr-timezone.ts",
);
const remainingSupportSql = repoFile(
  "supabase/migrations/20261021130000_gap024_remaining_gate_b_kiosk_support_wrappers.sql",
);
const remainingCutoverSql = repoFile(
  "supabase/migrations/20261021140000_gap024_remaining_gate_b_privilege_cutover.sql",
);
const kioskRepository = repoFile(
  "agui-starter/src/lib/hr/kiosk/repository.ts",
);
const kioskHttp = repoFile(
  "agui-starter/src/lib/hr/kiosk/http.ts",
);

function repositoryRoot() {
  const root = [
    resolve(process.cwd()),
    resolve(process.cwd(), ".."),
    resolve(process.cwd(), "../.."),
  ].find(
    (candidate) =>
      existsSync(resolve(candidate, "agui-starter/src")) &&
      existsSync(resolve(candidate, "supabase")),
  );
  assert.ok(root, "Repository root not found");
  return root;
}

function sourceFiles() {
  const root = repositoryRoot();
  const roots = [
    resolve(root, "agui-starter/src"),
    resolve(root, "agui-starter/scripts"),
  ];
  const files: string[] = [];

  function visit(path: string) {
    const info = statSync(path);
    if (info.isDirectory()) {
      const base = path.split(/[\\/]/).pop() ?? "";
      if (base === "__tests__" || base === "node_modules" || base === ".test-dist") return;
      for (const entry of readdirSync(path)) visit(resolve(path, entry));
      return;
    }
    if (!info.isFile() || !/\.(ts|tsx|js|cjs|mjs)$/.test(path)) return;
    if (/\.test\.(ts|tsx|js)$/.test(path)) return;
    const rel = relative(root, path).replace(/\\/g, "/");
    if (rel === "agui-starter/src/lib/db.types.ts") return;
    files.push(rel);
  }

  for (const rootPath of roots) visit(rootPath);
  return files.map((path) => ({ path, content: repoFile(path) }));
}

const rawMutationTables = [
  "dtr_segments",
  "dtr_entries",
  "hr_attendance_facts",
  "hr_attendance_fact_revisions",
  "hr_attendance_observations",
  "hr_attendance_evidence",
  "hr_attendance_evidence_frames",
  "hr_attendance_fact_evidence",
  "hr_attendance_employee_generations",
  "hr_attendance_authorization_projection",
  "hr_attendance_authorization_history",
  "hr_attendance_mutation_operations",
  "hr_attendance_correction_cases",
  "hr_attendance_correction_events",
  "hr_attendance_remediation_cases",
  "hr_attendance_remediation_events",
  "hr_kiosk_events",
] as const;

const mutationFunctionNames = [
  "hr_create_manual_attendance",
  "hr_update_manual_attendance",
  "hr_propose_attendance_correction",
  "hr_finalize_attendance_correction",
  "hr_open_attendance_remediation_case",
  "hr_adjudicate_attendance_remediation_case",
  "hr_finalize_attendance_remediation_case",
  "hr_replace_bulk_attendance_day",
  "hr_apply_kiosk_attendance_scan",
  "hr_apply_attendance_time_repair",
  "hr_apply_attendance_producer_mutation",
  "hr_record_kiosk_support_event",
  "hr_touch_kiosk_device_telemetry",
] as const;

function sqlFunction(sql: string, functionName: string) {
  const start = sql.toLowerCase().indexOf(
    `create or replace function public.${functionName.toLowerCase()}`,
  );
  assert.ok(start >= 0, `Missing SQL function: ${functionName}`);
  const end = sql.indexOf("$function$;", start);
  assert.ok(end > start, `Missing SQL terminator for: ${functionName}`);
  return sql.slice(start, end + "$function$;".length);
}

test("maintenance repair acquires employee serialization before the segment row lock", () => {
  assert.match(
    repairSql,
    /select segment\.employee_id[\s\S]*pg_advisory_xact_lock[\s\S]*select segment\.\*[\s\S]*for update/i,
  );
  assert.match(repairSql, /Attendance segment ownership changed during repair/i);
});

test("bulk replacement is authenticated, idempotent, canonical, and atomic with dtr_entries", () => {
  const bulkCommand = sqlFunction(bulkSql, "hr_replace_bulk_attendance_day");
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
    /left join public\.hr_attendance_authorization_projection[\s\S]*canonical_fact_id is null[\s\S]*attribution_state is distinct from 'ATTRIBUTED'[\s\S]*active_branch_id[\s\S]*hr_attendance_actor_can_write_branch/i,
  );
  assert.match(bulkSql, /Bulk attendance predecessor is outside caller write scope/i);
  assert.match(
    bulkSql,
    /update public\.hr_attendance_facts[\s\S]*set is_active = false/i,
  );
  assert.match(
    bulkSql,
    /insert into public\.hr_attendance_evidence_frames[\s\S]*'COMPLETED'[\s\S]*true/i,
  );
  assert.doesNotMatch(
    bulkCommand,
    /insert into public\.hr_attendance_evidence\s*\(/i,
    "bulk replacement must create an unproved frame rather than fabricate BULK_IMPORT provenance",
  );
  assert.match(
    bulkSql,
    /insert into public\.dtr_entries[\s\S]*on conflict \(employee_id, work_date\)/i,
  );
  assert.match(
    bulkSql,
    /grant execute on function public\.hr_replace_bulk_attendance_day[\s\S]*to authenticated/i,
  );
  assert.doesNotMatch(
    bulkSql,
    /create or replace function public\.hr_upsert_bulk_dtr_entry_summary/i,
  );
});

test("bulk API rejects partial attendance pairs before canonical replacement", () => {
  assert.match(
    bulkRoute,
    /const hasIn = Boolean\(rawIn\?\.trim\(\)\)[\s\S]*const hasOut = Boolean\(rawOut\?\.trim\(\)\)[\s\S]*if \(!hasIn \|\| !hasOut\)[\s\S]*Incomplete attendance segment/i,
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
  assert.doesNotMatch(bulkRoute, /hr_upsert_bulk_dtr_entry_summary/i);
  assert.match(
    bulkRoute,
    /payload\.mode === "single"[\s\S]*hr_replace_bulk_attendance_day[\s\S]*for \(const empId of allowedIds\)[\s\S]*hr_replace_bulk_attendance_day/i,
  );
  assert.doesNotMatch(
    bulkRoute,
    /service[\s\S]{0,120}\.from\("dtr_entries"\)[\s\S]{0,80}\.(insert|update|delete|upsert)\(/i,
  );
});

test("removed summary-only RPC is absent from generated client contracts", () => {
  assert.doesNotMatch(dbTypes, /hr_upsert_bulk_dtr_entry_summary/i);
});

test("bulk operation IDs survive retry across single, all, and CSV writes", () => {
  assert.match(bulkClient, /saveOperationIdsRef = useRef\(new Map<string, string>\(\)\)/i);
  assert.match(bulkClient, /const existing = saveOperationIdsRef\.current\.get\(fingerprint\)/i);
  assert.match(bulkClient, /crypto\.randomUUID\(\)/i);
  assert.match(bulkClient, /operationIds: Object\.fromEntries\([\s\S]*scopedEmployees\.flatMap/i);
  assert.match(
    bulkClient,
    /operationIds: Object\.fromEntries\([\s\S]*payload\.map\(\(row\)/i,
  );
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
  assert.doesNotMatch(
    dtrToday,
    /\.from\("dtr_entries"\)[\s\S]{0,80}\.(insert|update|delete|upsert)\(/i,
  );
  assert.doesNotMatch(dtrToday, /Save Rollup|Saved ✔ \(manual\)/i);

  const legacyPageCandidates = [
    resolve(process.cwd(), "src/app/payroll/dtr-bulk/page2.tsx"),
    resolve(process.cwd(), "agui-starter/src/app/payroll/dtr-bulk/page2.tsx"),
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
  assert.match(
    cutoverSql,
    /hr_kiosk_devices[\s\S]*device\.house_id = event\.house_id[\s\S]*device\.branch_id = event\.branch_id[\s\S]*device\.is_active = true/i,
  );
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
  assert.match(cutoverSql, /drop policy if exists dtr_entries_all on public\.dtr_entries/i);
  assert.match(
    cutoverSql,
    /revoke insert, update, delete, truncate, references, trigger[\s\S]*dtr_entries[\s\S]*from service_role/i,
  );
  assert.match(cutoverSql, /Gate-B cutover left a raw dtr_entries mutation privilege/i);
});


test("Remaining Gate B support wrappers are narrow, service-only, and derive trusted context", () => {
  assert.match(
    remainingSupportSql,
    /create or replace function public\.hr_record_kiosk_support_event\([\s\S]*p_device_id uuid[\s\S]*p_employee_id uuid[\s\S]*p_event_type text[\s\S]*p_occurred_at timestamptz[\s\S]*p_metadata jsonb[\s\S]*returns void[\s\S]*security definer[\s\S]*search_path = pg_catalog, public/i,
  );
  assert.match(remainingSupportSql, /p_event_type not in \('reject', 'sync_success', 'sync_fail'\)/i);
  assert.match(
    remainingSupportSql,
    /from public\.hr_kiosk_devices[\s\S]*where device\.id = p_device_id[\s\S]*employee\.house_id = v_device\.house_id/i,
  );
  assert.match(
    remainingSupportSql,
    /where device\.id = p_device_id[\s\S]*for update/i,
  );
  assert.match(
    remainingSupportSql,
    /insert into public\.hr_kiosk_events[\s\S]*v_device\.house_id[\s\S]*v_device\.branch_id/i,
  );
  assert.match(
    remainingSupportSql,
    /update public\.hr_kiosk_devices[\s\S]*set last_event_at = p_occurred_at[\s\S]*where id = v_device\.id/i,
  );
  assert.match(
    remainingSupportSql,
    /create or replace function public\.hr_touch_kiosk_device_telemetry\([\s\S]*p_device_id uuid[\s\S]*returns void[\s\S]*set last_seen_at = now\(\)/i,
  );
  assert.match(
    remainingSupportSql,
    /revoke all on function public\.hr_record_kiosk_support_event[\s\S]*from public, anon, authenticated, service_role[\s\S]*grant execute[\s\S]*to service_role/i,
  );
  assert.match(
    remainingSupportSql,
    /revoke all on function public\.hr_touch_kiosk_device_telemetry[\s\S]*from public, anon, authenticated, service_role[\s\S]*grant execute[\s\S]*to service_role/i,
  );
});

test("Remaining Gate B cutover removes canonical and kiosk supporting-state raw bypasses", () => {
  assert.match(remainingCutoverSql, /c\.relname like 'hr_attendance_%'/i);
  assert.match(
    remainingCutoverSql,
    /revoke all privileges on table %s from public, anon, authenticated, service_role/i,
  );
  assert.match(
    remainingCutoverSql,
    /revoke all on function public\.hr_rebuild_attendance_authorization_projection[\s\S]*from service_role/i,
  );
  assert.match(
    remainingCutoverSql,
    /drop policy if exists hr_kiosk_events_insert_house_roles[\s\S]*drop policy if exists hr_kiosk_events_update_house_roles[\s\S]*drop policy if exists hr_kiosk_events_delete_house_roles/i,
  );
  assert.match(
    remainingCutoverSql,
    /revoke all privileges on table public\.hr_kiosk_events from service_role/i,
  );
  assert.match(
    remainingCutoverSql,
    /revoke all privileges on table public\.hr_kiosk_devices from service_role[\s\S]*grant select on table public\.hr_kiosk_devices to service_role/i,
  );
  assert.match(
    remainingCutoverSql,
    /grant execute on function public\.hr_apply_kiosk_attendance_scan[\s\S]*to service_role[\s\S]*grant execute on function public\.hr_record_kiosk_support_event[\s\S]*to service_role[\s\S]*grant execute on function public\.hr_touch_kiosk_device_telemetry[\s\S]*to service_role/i,
  );
});

test("kiosk service-side supporting writes use RPCs rather than raw event/device mutation", () => {
  assert.match(kioskRepository, /rpc\("hr_touch_kiosk_device_telemetry"/i);
  assert.match(kioskRepository, /rpc\("hr_record_kiosk_support_event"/i);
  assert.doesNotMatch(
    kioskRepository,
    /\.from\("hr_kiosk_events"\)[\s\S]{0,500}?\.(insert|update|delete|upsert)\(/i,
  );
  assert.doesNotMatch(
    kioskRepository,
    /\.from\("hr_kiosk_devices"\)[\s\S]{0,500}?\.(insert|update|delete|upsert)\(/i,
  );
  assert.match(kioskHttp, /repo\.touchDevice\(auth\.deviceId\)/i);
  assert.doesNotMatch(
    kioskHttp,
    /\.from\("hr_kiosk_devices"\)[\s\S]{0,500}?\.(insert|update|delete|upsert)\(/i,
  );
});

test("application source has no direct canonical attendance table dependency", () => {
  const directCanonical = sourceFiles()
    .filter((file) => /\.from\(\s*["'`]hr_attendance_[^"'`]+["'`]\s*\)/i.test(file.content))
    .map((file) => file.path)
    .sort();

  assert.deepEqual(directCanonical, []);
});

test("repository-wide attendance producer discovery has no unclassified mutation call site", () => {
  const files = sourceFiles();
  const findings = new Map<string, Set<string>>();

  function record(path: string, finding: string) {
    const bucket = findings.get(path) ?? new Set<string>();
    bucket.add(finding);
    findings.set(path, bucket);
  }

  for (const file of files) {
    for (const table of rawMutationTables) {
      const rawMutation = new RegExp(
        "\\.from\\(\\s*[\\\"\'`]"+table+"[\\\"\'`]\\s*\\)[\\s\\S]{0,600}?\\.(insert|update|delete|upsert)\\(",
        "i",
      );
      if (rawMutation.test(file.content)) record(file.path, `raw:${table}`);
    }

    const deviceMutation = /\.from\(\s*["'`]hr_kiosk_devices["'`]\s*\)[\s\S]{0,600}?\.(insert|update|delete|upsert)\(/i;
    if (deviceMutation.test(file.content)) record(file.path, "raw:hr_kiosk_devices");

    for (const functionName of mutationFunctionNames) {
      if (file.content.includes(functionName)) record(file.path, `rpc:${functionName}`);
    }
  }

  const allowed = new Map<string, Set<string>>([
    [
      "agui-starter/src/lib/hr/dtr-segments-server.ts",
      new Set(["rpc:hr_create_manual_attendance"]),
    ],
    [
      "agui-starter/src/lib/hr/attendance-p1-server.ts",
      new Set([
        "rpc:hr_propose_attendance_correction",
        "rpc:hr_finalize_attendance_correction",
        "rpc:hr_open_attendance_remediation_case",
        "rpc:hr_adjudicate_attendance_remediation_case",
        "rpc:hr_finalize_attendance_remediation_case",
      ]),
    ],
    [
      "agui-starter/src/lib/hr/kiosk/repository.ts",
      new Set([
        "rpc:hr_apply_kiosk_attendance_scan",
        "rpc:hr_record_kiosk_support_event",
        "rpc:hr_touch_kiosk_device_telemetry",
      ]),
    ],
    [
      "agui-starter/src/lib/hr/kiosk/admin.ts",
      new Set(["raw:hr_kiosk_devices"]),
    ],
    [
      "agui-starter/src/app/api/payroll/dtr-bulk/route.ts",
      new Set(["rpc:hr_replace_bulk_attendance_day"]),
    ],
    [
      "agui-starter/scripts/fix-dtr-timezone.ts",
      new Set(["rpc:hr_apply_attendance_time_repair"]),
    ],
  ]);

  const normalized = [...findings.entries()]
    .map(([path, values]) => [path, [...values].sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const expected = [...allowed.entries()]
    .map(([path, values]) => [path, [...values].sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  assert.deepEqual(normalized, expected);
});


test("Remaining Gate B migration order stays after the released P1 dependency tip", () => {
  const latestP1 = "20261021120000";
  const support = "20261021130000";
  const cutover = "20261021140000";
  assert.ok(support > latestP1, "support-wrapper migration must run after P1");
  assert.ok(cutover > support, "privilege cutover must run after support-wrapper migration");
});
