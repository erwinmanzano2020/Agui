import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  updateWorkspaceBranding,
  updateWorkspaceSettings,
  WorkspaceSettingsUpdateError,
  __workspaceSettingsUpdateTesting,
} from "@/lib/settings/workspace-update";

type RecordedMutation = { kind: "set" | "reset"; input: Record<string, unknown>; actor: string | null };

const { buildWorkspaceSettingOperations } = __workspaceSettingsUpdateTesting;

class SupabaseRolesMock {
  houseUpdates: Array<{ values: Record<string, unknown>; id: string }> = [];

  constructor(private roles: string[]) {}

  from(table: string) {
    if (table === "house_roles") {
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

    if (table === "houses") {
      return {
        update: (values: Record<string, unknown>) => ({
          eq: (column: string, id: string) => {
            if (column !== "id") throw new Error(`Unexpected filter ${column}`);
            this.houseUpdates.push({ values, id });
            return { error: null };
          },
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
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
        branding: { brandName: "Collective Brand", logoUrl: "https://cdn.example.com/logo.png" },
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
      calls.map((entry) => ({
        key: entry.input.key,
        scope: entry.input.scope,
        value: (entry.input as { value?: unknown }).value,
        kind: entry.kind,
      })),
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
    assert.deepEqual(supabase.houseUpdates, [
      {
        id: "house-1",
        values: { brand_name: "Collective Brand", logo_url: "https://cdn.example.com/logo.png" },
      },
    ]);
  });

  it("updates branding directly on houses and preserves empty brand names", async () => {
    const supabase = new SupabaseRolesMock(["BUSINESS_OWNER"]);

    await updateWorkspaceBranding(
      "house-1",
      { brandName: "", logoUrl: "https://cdn.example.com/brand.png" },
      { client: supabase as never, actorEntityId: "entity-1", reload: false },
    );

    assert.deepEqual(supabase.houseUpdates, [
      {
        id: "house-1",
        values: { brand_name: "", logo_url: "https://cdn.example.com/brand.png" },
      },
    ]);
  });

  it("rejects invalid logo URL", async () => {
    const supabase = new SupabaseRolesMock(["BUSINESS_OWNER"]);

    await assert.rejects(
      () =>
        updateWorkspaceBranding(
          "house-1",
          { logoUrl: "ftp://example.com/logo.png" },
          { client: supabase as never, actorEntityId: "entity-1", reload: false },
        ),
      (error) =>
        error instanceof WorkspaceSettingsUpdateError &&
        error.status === 400 &&
        error.message === "Logo URL must start with http:// or https://",
    );

    assert.deepEqual(supabase.houseUpdates, []);
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
