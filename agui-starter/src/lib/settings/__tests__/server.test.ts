import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listSettingDefinitionsByCategory } from "@/lib/settings/catalog";
import { __settingsTesting } from "@/lib/settings/server";
import type { SettingsValueRow } from "@/lib/db.types";

const { buildSnapshotFromRows, isValidValue } = __settingsTesting;

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

    const snapshot = buildSnapshotFromRows(definitions, rows, { businessId: "biz-1", branchId: "branch-1" });
    const entry = snapshot["receipt.footer_text"];
    assert.ok(entry);
    assert.strictEqual(entry?.value, "Branch");
    assert.strictEqual(entry?.source, "BRANCH");
  });

  it("falls back to gm defaults when no overrides are present", () => {
    const definitions = listSettingDefinitionsByCategory("labels");
    const rows: SettingsValueRow[] = [];

    const snapshot = buildSnapshotFromRows(definitions, rows, { businessId: null, branchId: null });
    const entry = snapshot["labels.discount.manual"];
    assert.ok(entry);
    assert.strictEqual(entry?.source, "GM");
    assert.strictEqual(entry?.value, "Manual");
  });

  it("validates payload types", () => {
    assert.ok(isValidValue("receipt.show_total_savings", true));
    assert.ok(!isValidValue("receipt.show_total_savings", "yes"));
    assert.ok(isValidValue("pos.float_template", { hundred: 2 } as SettingsValueRow["value"]));
  });
});
