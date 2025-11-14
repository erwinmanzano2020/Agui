import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { listSettingDefinitionsByCategory } from "@/lib/settings/catalog";
import type { SettingsValueRow } from "@/lib/db.types";

type DatabaseClient = import("@supabase/supabase-js").SupabaseClient<import("@/lib/db.types").Database>;

let testingHelpers: typeof import("@/lib/settings/server").__settingsTesting;

before(async () => {
  ({ __settingsTesting: testingHelpers } = await import("@/lib/settings/server"));
});

function getTestingHelpers() {
  if (!testingHelpers) {
    throw new Error("Settings testing helpers not initialized");
  }
  return testingHelpers;
}

let rowCounter = 0;
function makeRow(
  overrides: Partial<SettingsValueRow> & {
    key: SettingsValueRow["key"];
    scope: SettingsValueRow["scope"];
    value: SettingsValueRow["value"];
  },
): SettingsValueRow {
  return {
    id: overrides.id ?? `row-${rowCounter++}`,
    key: overrides.key,
    scope: overrides.scope,
    business_id: overrides.business_id ?? null,
    branch_id: overrides.branch_id ?? null,
    value: overrides.value,
    version: overrides.version ?? 1,
    updated_by: overrides.updated_by ?? null,
    updated_at: overrides.updated_at ?? null,
  };
}

describe("settings server helpers", () => {
  it("prefers branch overrides over business and gm values", () => {
    const { buildSnapshotFromRows: buildSnapshot } = getTestingHelpers();
    const definitions = listSettingDefinitionsByCategory("receipt");
    const rows: SettingsValueRow[] = [
      makeRow({ key: "receipt.footer_text", scope: "GM", value: "Global" }),
      makeRow({ key: "receipt.footer_text", scope: "BUSINESS", business_id: "biz-1", value: "Biz" }),
      makeRow({
        key: "receipt.footer_text",
        scope: "BRANCH",
        business_id: "biz-1",
        branch_id: "branch-1",
        value: "Branch",
      }),
    ];
    const snapshot = buildSnapshot(definitions, rows, { businessId: "biz-1", branchId: "branch-1" });
    const entry = snapshot["receipt.footer_text"];
    assert.ok(entry);
    assert.strictEqual(entry?.value, "Branch");
    assert.strictEqual(entry?.source, "BRANCH");
  });

  it("falls back to gm defaults when no overrides are present", () => {
    const { buildSnapshotFromRows: buildSnapshot } = getTestingHelpers();
    const definitions = listSettingDefinitionsByCategory("labels");
    const rows: SettingsValueRow[] = [];
    const snapshot = buildSnapshot(definitions, rows, { businessId: null, branchId: null });
    const entry = snapshot["labels.discount.manual"];
    assert.ok(entry);
    assert.strictEqual(entry?.source, "GM");
    assert.strictEqual(entry?.value, "Manual");
  });

  it("validates payload types", () => {
    const { isValidValue: validate } = getTestingHelpers();
    assert.ok(validate("receipt.show_total_savings", true));
    assert.ok(!validate("receipt.show_total_savings", "yes"));
    assert.ok(validate("pos.float_template", { hundred: 2 } as SettingsValueRow["value"]));
  });

  it("writes an audit row when a setting is updated", async () => {
    const helpers = getTestingHelpers();

    class MockSupabase {
      auditInserts: unknown[] = [];
      valuesUpserts: unknown[] = [];

      from(table: string) {
        if (table === "settings_values") {
          const builder = {
            select: () => builder,
            match: () => builder,
            maybeSingle: async () => ({ data: null, error: null } as const),
            upsert: async (payload: unknown) => {
              this.valuesUpserts.push(payload);
              return { data: null, error: null } as const;
            },
            delete: () => ({
              eq: async () => ({ error: null } as const),
            }),
          };
          return builder;
        }

        if (table === "settings_audit") {
          return {
            insert: async (payload: unknown) => {
              this.auditInserts.push(payload);
              return { data: null, error: null } as const;
            },
          };
        }

        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { profile: null }, error: null } as const),
            }),
          }),
        };
      }
    }

    const client = new MockSupabase();

    await helpers.mutateSettingWithClient(
      client as unknown as DatabaseClient,
      {
        key: "receipt.footer_text",
        scope: "GM",
        value: "Updated footer",
      },
      "entity-123",
    );

    assert.strictEqual(client.auditInserts.length, 1);
    const audit = client.auditInserts[0] as Record<string, unknown>;
    assert.strictEqual(audit.key, "receipt.footer_text");
    assert.strictEqual(audit.scope, "GM");
    assert.strictEqual(audit.changed_by, "entity-123");
    assert.strictEqual(audit.new_value, "Updated footer");
  });
});
