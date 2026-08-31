import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const migrationRelativePath =
  "supabase/migrations/20260829120000_hr_write_capability_policy.sql";
const repositoryRoots = [resolve(process.cwd(), ".."), resolve(process.cwd(), "../..")];
const repositoryRoot = repositoryRoots.find((candidate) =>
  existsSync(resolve(candidate, migrationRelativePath)),
);

assert.ok(repositoryRoot, "repository root containing the GAP-023 migration must be resolvable");

const migrationPath = resolve(repositoryRoot, migrationRelativePath);
const migration = readFileSync(migrationPath, "utf8");
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

test("GAP-023 migration supports the canonical key-based policies schema", () => {
  assert.match(
    normalized,
    /insert into public\.policies \(key, description\) values \('domain\.hr\.all', 'full hr action capability'\)/,
  );
  assert.match(normalized, /on conflict \(key\) do update set description = excluded\.description/);
});

test("GAP-023 migration remains idempotent and reconciles an existing description", () => {
  const upserts = normalized.match(/on conflict \(key\) do update/g) ?? [];
  assert.equal(upserts.length, 2);
  assert.equal(
    normalized.match(/set description = excluded\.description/g)?.length,
    2,
  );
});

test("GAP-023 migration does not mutate assignments or membership", () => {
  assert.doesNotMatch(normalized, /(?:insert|update|delete)\s+(?:into\s+)?public\.role_policies/);
  assert.doesNotMatch(normalized, /(?:insert|update|delete)\s+(?:into\s+)?public\.(?:house|guild|platform)_roles/);
  assert.doesNotMatch(normalized, /(?:insert|update|delete)\s+(?:into\s+)?public\.entity_role_memberships/);
});

test("GAP-023 migration does not add legacy policy columns", () => {
  assert.doesNotMatch(normalized, /alter table public\.policies/);
  assert.doesNotMatch(normalized, /add column/);
});

test("GAP-023 migration preserves the evidenced extended-schema replay path", () => {
  assert.match(normalized, /from information_schema\.columns/);
  assert.match(normalized, /column_name = 'action'/);
  assert.match(
    normalized,
    /insert into public\.policies \(key, action, resource, description\) values \('domain\.hr\.all', 'hr:\*', '\*', 'full hr action capability'\)/,
  );
});
