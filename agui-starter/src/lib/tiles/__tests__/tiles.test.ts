import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTilesResponse } from "@/lib/tiles/compute";
import type { BuildTilesInput } from "@/lib/tiles/types";

function baseInput(overrides: Partial<BuildTilesInput> = {}): BuildTilesInput {
  return {
    loyalties: [],
    workspaces: [],
    tileAssignments: [],
    policies: [],
    gmAccess: false,
    inboxUnreadCount: 0,
    apps: [],
    visibilityRules: [],
    ...overrides,
  } satisfies BuildTilesInput;
}

describe("buildTilesResponse", () => {
  it("creates one loyalty tile for a single membership", () => {
    const response = buildTilesResponse(
      baseInput({
        loyalties: [
          { businessId: "house-1", label: "Vangie Pass" },
        ],
      }),
    );

    assert.strictEqual(response.home.length, 1);
    const tile = response.home[0];
    assert.strictEqual(tile.kind, "loyalty-pass");
    if (tile.kind === "loyalty-pass") {
      assert.strictEqual(tile.businessId, "house-1");
    }
  });

  it("creates multiple loyalty tiles when enrolled in multiple passes", () => {
    const response = buildTilesResponse(
      baseInput({
        loyalties: [
          { businessId: "house-1", label: "Vangie Pass" },
          { businessId: "house-2", label: "Alliance Pass" },
        ],
      }),
    );

    assert.strictEqual(response.home.length, 2);
    assert.deepStrictEqual(response.home.map((tile) => tile.kind), ["loyalty-pass", "loyalty-pass"]);
  });

  it("hides finance section for staff without finance policies", () => {
    const response = buildTilesResponse(
      baseInput({
        workspaces: [
          {
            businessId: "house-1",
            label: "Vangie Store",
            slug: "vangie-store",
            roles: ["staff"],
            enabledApps: [],
          },
        ],
        policies: ["tiles.pos.read"],
      }),
    );

    const sections = response.workspaces[0]?.sections ?? [];
    assert.ok(sections.some((section) => section.key === "operations"));
    assert.ok(!sections.some((section) => section.key === "finance"));
  });

  it("shows all primary sections for an owner", () => {
    const response = buildTilesResponse(
      baseInput({
        workspaces: [
          {
            businessId: "house-1",
            label: "Vangie Store",
            slug: "vangie-store",
            roles: ["owner"],
            enabledApps: [],
          },
        ],
        policies: [
          "tiles.team.read",
          "tiles.pos.read",
          "domain.ledger.all",
          "roles.manage.house",
        ],
      }),
    );

    const sectionKeys = response.workspaces[0]?.sections.map((section) => section.key) ?? [];
    assert.deepStrictEqual(sectionKeys, ["overview", "people", "operations", "finance", "settings"]);
  });
});
