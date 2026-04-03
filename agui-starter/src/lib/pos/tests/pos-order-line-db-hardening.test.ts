import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const MIGRATION_FILE = "20261018122000_pos_order_lines_foundation.sql";

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

test("migration creates pos_order_lines with bounded f2 status restriction", () => {
  const sql = normalizedSql();

  assert.match(sql, /create table if not exists public\.pos_order_lines/);
  assert.match(sql, /status text not null default 'active' check \(status in \('active', 'removed'\)\)/);
});

test("migration adds order and session scoped integrity constraints for pos_order_lines", () => {
  const sql = normalizedSql();

  assert.doesNotMatch(sql, /order_id uuid not null references public\.pos_order_drafts\(id\) on delete cascade/);

  assert.match(sql, /pos_order_lines_house_branch_fkey/);
  assert.match(sql, /foreign key \(house_id, branch_id\).*references public\.branches\(house_id, id\)/);

  assert.match(sql, /pos_order_lines_session_device_house_branch_fkey/);
  assert.match(
    sql,
    /foreign key \(session_id, device_id, house_id, branch_id\).*references public\.pos_sessions\(id, device_id, house_id, branch_id\)/,
  );

  assert.match(sql, /pos_order_lines_order_scope_fkey/);
  assert.match(
    sql,
    /foreign key \(order_id, device_id, session_id, house_id, branch_id\).*references public\.pos_order_drafts\(id, device_id, session_id, house_id, branch_id\)/,
  );
});

test("migration adds bounded f2 indexes and house-scoped rls policy for pos_order_lines", () => {
  const sql = normalizedSql();

  assert.match(sql, /pos_order_lines_session_draft_active_idx/);
  assert.match(sql, /on public\.pos_order_lines\(house_id, branch_id, session_id, device_id, order_id, status\)/);

  assert.match(sql, /pos_order_lines_scope_line_active_idx/);
  assert.match(sql, /on public\.pos_order_lines\(house_id, branch_id, session_id, device_id, order_id, id, status\)/);

  assert.match(sql, /alter table public\.pos_order_lines enable row level security/);
  assert.match(sql, /create policy pos_order_lines_manage_by_house on public\.pos_order_lines/);
  assert.match(sql, /grant select, insert, update on table public\.pos_order_lines to authenticated/);
});
