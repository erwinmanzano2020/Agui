import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const MIGRATION_FILE = "20261018121000_pos_order_drafts_session_device_integrity.sql";

function resolveMigrationPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "../supabase/migrations", MIGRATION_FILE),
    path.resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    path.resolve(process.cwd(), "../../supabase/migrations", MIGRATION_FILE),
    path.resolve(process.cwd(), "../../../supabase/migrations", MIGRATION_FILE),
  ];

  const found = candidates.find((p) => existsSync(p));
  assert.ok(found, `Could not locate migration file: ${MIGRATION_FILE}`);

  return found;
}

function normalizedSql(): string {
  return readFileSync(resolveMigrationPath(), "utf8").replace(/\s+/g, " ").toLowerCase();
}

test("migration adds unique index for pos_sessions id+device+house+branch", () => {
  const sql = normalizedSql();

  assert.match(sql, /pos_sessions_id_device_house_branch_unique_idx/);
  assert.match(sql, /on public\.pos_sessions\(id, device_id, house_id, branch_id\)/);
});

test("migration enforces pos_order_drafts session+device+house+branch linkage to pos_sessions", () => {
  const sql = normalizedSql();

  assert.match(sql, /pos_order_drafts_session_device_house_branch_fkey/);
  assert.match(
    sql,
    /foreign key \(session_id, device_id, house_id, branch_id\).*references public\.pos_sessions\(id, device_id, house_id, branch_id\)/,
  );
});
