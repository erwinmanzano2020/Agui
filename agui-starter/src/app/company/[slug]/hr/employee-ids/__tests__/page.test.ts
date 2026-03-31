import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as requireAuthModule from "@/lib/auth/require-auth";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import * as employeeIdCardsServer from "@/lib/hr/employee-id-cards-server";
import EmployeeIdsPage from "../page";

describe("EmployeeIdsPage", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("keeps branch metadata/filter parity for branch-limited access", async () => {
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

    const listEmployeeIdCardsMock = mock.method(employeeIdCardsServer, "listEmployeeIdCards", async () => []);

    const element = await EmployeeIdsPage({
      params: Promise.resolve({ slug: "demo-house" }),
      searchParams: Promise.resolve({ branch: "branch-2" }),
    });

    const props = (element as { props?: { branches?: Array<{ id: string }>; initialBranchId?: string } }).props;
    assert.deepEqual(
      props?.branches?.map((branch) => branch.id),
      ["branch-1"],
    );
    assert.equal(props?.initialBranchId, "");

    assert.equal(listEmployeeIdCardsMock.mock.calls.length, 1);
    const [supabaseArg, houseIdArg, filtersArg] = listEmployeeIdCardsMock.mock.calls[0].arguments as [
      unknown,
      string,
      { branchId?: string; search?: string },
    ];
    assert.ok(supabaseArg);
    assert.equal(houseIdArg, "house-1");
    assert.equal(filtersArg.branchId, undefined);
  });

  it("preserves allowed branch filter when branch metadata list is empty", async () => {
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

    const listEmployeeIdCardsMock = mock.method(employeeIdCardsServer, "listEmployeeIdCards", async () => []);

    const element = await EmployeeIdsPage({
      params: Promise.resolve({ slug: "demo-house" }),
      searchParams: Promise.resolve({ branch: "branch-1" }),
    });

    const props = (element as { props?: { branches?: Array<{ id: string }>; initialBranchId?: string } }).props;
    assert.deepEqual(props?.branches ?? [], []);
    assert.equal(props?.initialBranchId, "branch-1");

    assert.equal(listEmployeeIdCardsMock.mock.calls.length, 1);
    const [, , filtersArg] = listEmployeeIdCardsMock.mock.calls[0].arguments as [
      unknown,
      string,
      { branchId?: string; search?: string },
    ];
    assert.equal(filtersArg.branchId, "branch-1");
  });

});
