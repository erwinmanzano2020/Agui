import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationRelativePath =
  "supabase/migrations/20261020100000_gap024_gate_b_containment_foundation.sql";
const migrationPath = [
  resolve(process.cwd(), "..", migrationRelativePath),
  resolve(process.cwd(), "../..", migrationRelativePath),
].find(existsSync);

assert.ok(
  migrationPath,
  "Gate-B containment foundation migration must be resolvable in focused and full-suite runners",
);

const sql = readFileSync(migrationPath, "utf8");

function functionSql(name: string, nextName?: string) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `Expected function ${name}`);
  const end = nextName
    ? sql.indexOf(`create or replace function public.${nextName}`, start)
    : sql.length;
  return sql.slice(start, end === -1 ? sql.length : end);
}

test("adds a deletion-safe one-row canonical fact bridge", () => {
  assert.match(
    sql,
    /alter table public\.dtr_segments\s+add column if not exists canonical_fact_id uuid/i,
  );
  assert.match(
    sql,
    /create unique index if not exists dtr_segments_canonical_fact_unique_idx[\s\S]*where canonical_fact_id is not null/i,
  );
  assert.match(
    sql,
    /foreign key \(house_id, canonical_fact_id, employee_id\)[\s\S]*references public\.hr_attendance_facts\(house_id, id, employee_id\)[\s\S]*on delete restrict/i,
  );
});

test("durable operation identity is private and fingerprinted", () => {
  const tableStart = sql.indexOf(
    "create table if not exists public.hr_attendance_mutation_operations",
  );
  assert.notEqual(tableStart, -1);
  const tableEnd = sql.indexOf(
    "alter table public.hr_attendance_mutation_operations enable row level security",
    tableStart,
  );
  const tableSql = sql.slice(tableStart, tableEnd);

  assert.match(
    tableSql,
    /primary key \(house_id, producer_namespace, operation_id\)/i,
  );
  assert.match(
    tableSql,
    /request_fingerprint text not null check \(length\(btrim\(request_fingerprint\)\) > 0\)/i,
  );
  assert.match(tableSql, /outcome jsonb/i);
  assert.match(tableSql, /fact_id uuid/i);
  assert.match(tableSql, /value_revision bigint/i);
  assert.match(tableSql, /evidence_basis_revision bigint/i);
  assert.match(
    sql,
    /revoke all on public\.hr_attendance_mutation_operations from public, anon, authenticated, service_role/i,
  );
});

test("transitional bridge guard blocks application roles but preserves definer path", () => {
  const guard = functionSql(
    "hr_guard_dtr_segment_canonical_bridge",
    "hr_attendance_actor_can_write_branch",
  );

  assert.match(
    guard,
    /current_user in \('anon', 'authenticated', 'service_role'\)/i,
  );
  assert.match(
    guard,
    /tg_op = 'INSERT'[\s\S]*new\.canonical_fact_id is not null[\s\S]*42501/i,
  );
  assert.match(
    guard,
    /tg_op = 'UPDATE'[\s\S]*old\.canonical_fact_id is not null[\s\S]*new\.canonical_fact_id is distinct from old\.canonical_fact_id[\s\S]*42501/i,
  );
  assert.match(
    guard,
    /tg_op = 'DELETE'[\s\S]*old\.canonical_fact_id is not null[\s\S]*42501/i,
  );
  assert.match(
    sql,
    /create trigger dtr_segments_canonical_bridge_guard[\s\S]*before insert or update or delete on public\.dtr_segments/i,
  );
  assert.match(
    guard,
    /tg_op = 'TRUNCATE'[\s\S]*Raw attendance writers cannot truncate canonical compatibility state[\s\S]*42501/i,
  );
  assert.match(
    sql,
    /create trigger dtr_segments_canonical_truncate_guard[\s\S]*before truncate on public\.dtr_segments[\s\S]*for each statement/i,
  );
});

test("manual branch authorization preserves House and branch write scope", () => {
  const auth = functionSql("hr_attendance_actor_can_write_branch");

  assert.match(auth, /security definer/i);
  assert.match(
    auth,
    /from public\.branches branch[\s\S]*branch\.house_id = p_house_id[\s\S]*branch\.id = p_branch_id/i,
  );
  assert.match(
    auth,
    /lower\(btrim\(hr\.role\)\) in \([\s\S]*'house_owner'[\s\S]*'business_owner'[\s\S]*'house_manager'[\s\S]*'business_admin'[\s\S]*'business_manager'/i,
  );
  assert.match(
    auth,
    /hr\.role_id is not null[\s\S]*p\.key = 'domain\.hr\.all'/i,
  );
  assert.match(auth, /'hr\.branch\.' \|\| p_branch_id::text/i);
  assert.match(auth, /'tiles\.hr\.branch\.' \|\| p_branch_id::text/i);
  assert.match(auth, /'hr:branch:' \|\| p_branch_id::text/i);
  assert.match(auth, /'tiles:hr:branch:' \|\| p_branch_id::text/i);
  assert.match(
    sql,
    /revoke all on function public\.hr_attendance_actor_can_write_branch\(uuid, uuid, uuid\)[\s\S]*from public, anon, authenticated, service_role/i,
  );
});

test("foundation remains additive and does not perform producer cutover", () => {
  assert.doesNotMatch(sql, /revoke\s+(insert|update|delete|truncate)[\s\S]*on public\.dtr_segments/i);
  assert.doesNotMatch(sql, /delete\s+from public\.dtr_segments/i);
  assert.doesNotMatch(sql, /update\s+public\.dtr_segments\s+set canonical_fact_id/i);
  assert.doesNotMatch(sql, /insert\s+into public\.hr_attendance_facts/i);
  assert.match(sql, /notify pgrst, 'reload schema'/i);
});
