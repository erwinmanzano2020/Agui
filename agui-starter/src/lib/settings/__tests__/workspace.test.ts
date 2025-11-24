import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SettingKey } from "@/lib/settings/catalog";
import type { SettingsSnapshot } from "@/lib/settings/types";
import {
  WORKSPACE_SETTINGS_DEFAULTS,
  __workspaceSettingsTesting,
  type WorkspaceSettings,
} from "@/lib/settings/workspace";

const { normalizeWorkspaceSettings, loadWorkspaceSettingsWithLoader } = __workspaceSettingsTesting;

describe("workspace settings loader", () => {
  it("returns defaults when loader throws", async () => {
    const result = await loadWorkspaceSettingsWithLoader("house-1", async () => {
      throw Object.assign(new Error("denied"), { code: "42501" });
    });

    assert.deepEqual(result, WORKSPACE_SETTINGS_DEFAULTS);
  });

  it("returns defaults when loader provides empty snapshots", async () => {
    const result = await loadWorkspaceSettingsWithLoader("house-1", async () => ({} as SettingsSnapshot));

    assert.deepEqual(result, WORKSPACE_SETTINGS_DEFAULTS);
  });

  it("normalizes values from snapshots", () => {
    function makeSnapshot(entries: Array<[SettingKey, unknown]>) {
      const snapshot: SettingsSnapshot = {};
      entries.forEach(([key, value]) => {
        snapshot[key] = { key, value: value as never, source: "GM" };
      });
      return snapshot;
    }

    const snapshot: WorkspaceSettings = normalizeWorkspaceSettings({
      labels: makeSnapshot([
        ["labels.house", "collective"],
        ["labels.branch", "location"],
        ["labels.pass", "badge"],
        ["labels.discount.loyalty", "Rewards"],
        ["labels.discount.wholesale", "Bulk"],
        ["labels.discount.manual", "Override"],
        ["labels.discount.promo", "Deal"],
      ]),
      receipt: makeSnapshot([
        ["receipt.footer_text", "See you soon"],
        ["receipt.show_total_savings", false],
        ["receipt.print_profile", "a4"],
      ]),
      sop: makeSnapshot([
        ["sop.start_shift_hint", "Check your float"],
        ["sop.blind_drop_hint", "Double count"],
        ["sop.cashier_variance_thresholds", { small: 1, medium: 2, large: 3 }],
      ]),
      pos: makeSnapshot([
        ["pos.cash.blind_drop_enabled", false],
        ["pos.cash.overage_pool.enabled", false],
        ["pos.cash.overage_pool.max_offset_ratio", 0.25],
        ["pos.cash.float.defaults", { 100: 2, 20: 1, note: "ignore" }],
      ]),
      ui: makeSnapshot([["gm.ui.always_show_start_business_tile", true]]),
    });

    assert.deepEqual(snapshot.labels, {
      house: "collective",
      branch: "location",
      pass: "badge",
      discounts: { loyalty: "Rewards", wholesale: "Bulk", manual: "Override", promo: "Deal" },
    });
    assert.deepEqual(snapshot.receipt, {
      footerText: "See you soon",
      showTotalSavings: false,
      printProfile: "a4",
    });
    assert.deepEqual(snapshot.sop, {
      startShiftHint: "Check your float",
      blindDropHint: "Double count",
      cashierVarianceThresholds: { small: 1, medium: 2, large: 3 },
    });
    assert.deepEqual(snapshot.pos, {
      blindDropEnabled: false,
      overagePool: { enabled: false, maxOffsetRatio: 0.25 },
      floatDefaults: { 20: 1, 100: 2 },
    });
    assert.deepEqual(snapshot.ui, { alwaysShowStartBusinessTile: true });
  });
});
