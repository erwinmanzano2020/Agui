import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const MIGRATION_FILE = "20261018113000_pos_scope_consistency_hardening.sql";

function resolveMigrationPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "../supabase/migrations", MIGRATION_FILE),
    path.resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    path.resolve(process.cwd(), "../../supabase/migrations", MIGRATION_FILE),
    path.resolve(process.cwd(), "../../../supabase/migrations", MIGRATION_FILE),
  ];

  const found = candidates.find((p) => existsSync(p));
  assert.ok(found, `Could not locate migration file: ${MIGRATION_FILE}`);

  return found!;
}

function migrationSql(): string {
  return readFileSync(resolveMigrationPath(), "utf8");
}

function normalizedSql(): string {
  return migrationSql().replace(/\s+/g, " ").toLowerCase();
}

test("migration enforces pos_devices house+branch consistency against branches", () => {
  const sql = normalizedSql();

  assert.match(sql, /branches_house_id_id_unique_idx/);
  assert.match(
    sql,
    /foreign key \(house_id, branch_id\).*references public\.branches\(house_id, id\)/,
  );
});

test("migration enforces pos_sessions house+branch consistency against branches", () => {
  const sql = normalizedSql();

  assert.match(sql, /pos_sessions_house_branch_fkey/);
  assert.match(
    sql,
    /foreign key \(house_id, branch_id\).*references public\.branches\(house_id, id\)/,
  );
});

test("migration enforces pos_sessions device+house+branch consistency against pos_devices", () => {
  const sql = normalizedSql();

  assert.match(sql, /pos_devices_id_house_branch_unique_idx/);
  assert.match(
    sql,
    /foreign key \(device_id, house_id, branch_id\).*references public\.pos_devices\(id, house_id, branch_id\)/,
  );
});
