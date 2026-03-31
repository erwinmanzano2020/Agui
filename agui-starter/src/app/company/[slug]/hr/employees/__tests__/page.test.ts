import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as requireAuthModule from "@/lib/auth/require-auth";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import HrEmployeesPage from "../page";

describe("HrEmployeesPage", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("preserves branch-scoped row filters when branch metadata loading fails", async () => {
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
      branches: [],
      error: "Failed to load branches",
    }));

    const listEmployeesMock = mock.method(employeesServer, "listEmployeesByHouse", async () => ({ employees: [] }));

    await HrEmployeesPage({
      params: Promise.resolve({ slug: "demo-house" }),
      searchParams: Promise.resolve({ branch: "branch-1" }),
    });

    assert.equal(listEmployeesMock.mock.calls.length, 1);
    const [, , filtersArg] = listEmployeesMock.mock.calls[0].arguments as [
      unknown,
      string,
      { branchId: string | null; status: string; search: string },
    ];
    assert.equal(filtersArg.branchId, "branch-1");
  });
});
