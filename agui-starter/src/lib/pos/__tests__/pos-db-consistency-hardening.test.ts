import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.resolve(
  process.cwd(),
  "../supabase/migrations/20261018113000_pos_scope_consistency_hardening.sql",
);

function migrationSql(): string {
  return readFileSync(migrationPath, "utf8");
}

test("migration enforces pos_devices house+branch consistency against branches", () => {
  const sql = migrationSql();

  assert.match(sql, /create unique index if not exists branches_house_id_id_unique_idx/i);
  assert.match(sql, /foreign key \(house_id, branch_id\)[\s\S]*references public\.branches\(house_id, id\)/i);
});

test("migration enforces pos_sessions house+branch consistency against branches", () => {
  const sql = migrationSql();

  assert.match(sql, /add constraint pos_sessions_house_branch_fkey/i);
  assert.match(sql, /foreign key \(house_id, branch_id\)[\s\S]*references public\.branches\(house_id, id\)/i);
});

test("migration enforces pos_sessions device+house+branch consistency against pos_devices", () => {
  const sql = migrationSql();

  assert.match(sql, /create unique index if not exists pos_devices_id_house_branch_unique_idx/i);
  assert.match(sql, /foreign key \(device_id, house_id, branch_id\)[\s\S]*references public\.pos_devices\(id, house_id, branch_id\)/i);
});
