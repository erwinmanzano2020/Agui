import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as requireAuthModule from "@/lib/auth/require-auth";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import * as kioskAdmin from "@/lib/hr/kiosk/admin";
import KioskDevicesPage from "../page";

describe("KioskDevicesPage", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("keeps branch metadata in parity with branch-limited device rows", async () => {
    const house = { id: "house-1", slug: "demo-house", name: "Demo House" };

    mock.method(requireAuthModule, "requireAuth", async () => ({
      supabase: {
        from(table: string) {
          assert.equal(table, "houses");
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: house, error: null }),
          };
        },
      } as never,
    }));

    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      hasWorkspaceAccess: true,
      allowedByRole: false,
      allowedByPolicy: true,
      roles: ["house_staff"],
      normalizedRoles: ["staff"],
      policyKeys: ["tiles.hr.read", "tiles.hr.branch.branch-1"],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: ["branch-1"],
    }) as never);

    mock.method(employeesServer, "listBranchesForHouse", async () => ({
      branches: [
        { id: "branch-1", name: "Main" },
        { id: "branch-2", name: "Annex" },
      ],
      error: null,
    }));

    mock.method(kioskAdmin, "listKioskDevicesForHouse", async () => [
      {
        id: "device-1",
        house_id: "house-1",
        branch_id: "branch-1",
        name: "Front Desk",
        is_active: true,
        created_at: "2026-03-30T00:00:00.000Z",
        last_seen_at: null,
        last_event_at: null,
        disabled_at: null,
        disabled_by: null,
      },
    ]);

    const element = await KioskDevicesPage({ params: Promise.resolve({ slug: "demo-house" }) });
    const branches = (element as { props?: { branches?: Array<{ id: string }> } })?.props?.branches ?? [];

    assert.deepEqual(branches.map((branch) => branch.id), ["branch-1"]);
  });
});
