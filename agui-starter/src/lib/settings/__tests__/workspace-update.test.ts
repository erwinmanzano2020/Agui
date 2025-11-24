import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  updateWorkspaceSettings,
  WorkspaceSettingsUpdateError,
  __workspaceSettingsUpdateTesting,
} from "@/lib/settings/workspace-update";

type RecordedMutation = { kind: "set" | "reset"; input: Record<string, unknown>; actor: string | null };

const { buildWorkspaceSettingOperations } = __workspaceSettingsUpdateTesting;

class SupabaseRolesMock {
  constructor(private roles: string[]) {}

  from(table: string) {
    if (table !== "house_roles") {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            data: this.roles.map((role) => ({ role })),
            error: null,
          }),
        }),
      }),
    };
  }
}

describe("workspace settings update", () => {
  it("builds operations only for provided fields", () => {
    const operations = buildWorkspaceSettingOperations({
      receipt: { footerText: "" },
      labels: { discounts: { promo: "Deal" } },
    });

    const simplified = operations
      .map((op) => ({ key: op.key, value: op.value }))
      .sort((a, b) => a.key.localeCompare(b.key));

    assert.deepEqual(simplified, [
      { key: "labels.discount.promo", value: "Deal" },
      { key: "receipt.footer_text", value: null },
    ]);
  });

  it("updates provided keys when authorized", async () => {
    const supabase = new SupabaseRolesMock(["BUSINESS_OWNER"]);
    const calls: RecordedMutation[] = [];
    const writer = async (input: Record<string, unknown>, actor: string | null) => {
      calls.push({ kind: "set", input, actor });
    };
    const resetter = async (input: Record<string, unknown>, actor: string | null) => {
      calls.push({ kind: "reset", input, actor });
    };

    await updateWorkspaceSettings(
      "house-1",
      {
        labels: { house: "Collective", pass: "" },
        receipt: { footerText: "Thanks" },
        sop: { cashierVarianceThresholds: { small: 1, medium: 2, large: 3 } },
        pos: { blindDropEnabled: false, overagePool: { enabled: true, maxOffsetRatio: 0.25 } },
      },
      {
        client: supabase as never,
        actorEntityId: "entity-1",
        writer: writer as never,
        resetter: resetter as never,
        reload: false,
      },
    );

    assert.deepEqual(
      calls.map((entry) => ({ key: entry.input.key, scope: entry.input.scope, value: (entry.input as { value?: unknown }).value, kind: entry.kind })),
      [
        { kind: "set", key: "labels.house", scope: "BUSINESS", value: "Collective" },
        { kind: "reset", key: "labels.pass", scope: "BUSINESS", value: undefined },
        { kind: "set", key: "receipt.footer_text", scope: "BUSINESS", value: "Thanks" },
        {
          kind: "set",
          key: "sop.cashier_variance_thresholds",
          scope: "BUSINESS",
          value: { small: 1, medium: 2, large: 3 },
        },
        { kind: "set", key: "pos.cash.blind_drop_enabled", scope: "BUSINESS", value: false },
        { kind: "set", key: "pos.cash.overage_pool.enabled", scope: "BUSINESS", value: true },
        { kind: "set", key: "pos.cash.overage_pool.max_offset_ratio", scope: "BUSINESS", value: 0.25 },
      ],
    );

    assert.ok(calls.every((call) => call.actor === "entity-1"));
  });

  it("rejects unauthorized updates", async () => {
    const supabase = new SupabaseRolesMock(["BUSINESS_STAFF"]);
    const calls: RecordedMutation[] = [];
    const writer = async (input: Record<string, unknown>, actor: string | null) => {
      calls.push({ kind: "set", input, actor });
    };
    const resetter = async (input: Record<string, unknown>, actor: string | null) => {
      calls.push({ kind: "reset", input, actor });
    };

    await assert.rejects(
      () =>
        updateWorkspaceSettings(
          "house-2",
          { labels: { house: "Test" } },
          { client: supabase as never, actorEntityId: "entity-2", writer: writer as never, resetter: resetter as never },
        ),
      (error) => error instanceof WorkspaceSettingsUpdateError && error.status === 403,
    );

    assert.strictEqual(calls.length, 0);
  });
});
