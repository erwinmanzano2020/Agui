import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEmployeeRow,
  canManageEmployees,
  createEmployee,
  createInMemoryEmployeeRepository,
  EmployeeAccessError,
  listEmployees,
  updateEmployee,
} from "../employees";

const ownerAccess = {
  houseId: "house-1",
  roles: ["house_owner"],
  policyKeys: ["tiles.hr.read"],
};

const staffAccess = {
  houseId: "house-1",
  roles: ["house_staff"],
  policyKeys: [],
};

describe("employees access control", () => {
  it("allows owners/managers within the house to create and list employees", async () => {
    const repo = createInMemoryEmployeeRepository({ branches: { "branch-1": "house-1" } });

    const created = await createEmployee(repo, ownerAccess, {
      house_id: "house-1",
      code: "E-01",
      full_name: "Ada Lovelace",
      rate_per_day: 1200,
      branch_id: "branch-1",
    });

    assert.equal(created.full_name, "Ada Lovelace");
    assert.equal(created.rate_per_day, 1200);

    const rows = await listEmployees(repo, ownerAccess);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, created.id);
  });

  it("rejects users without HR privileges", async () => {
    const repo = createInMemoryEmployeeRepository();

    await assert.rejects(
      () =>
        createEmployee(repo, staffAccess, {
          house_id: "house-1",
          code: "E-02",
          rate_per_day: 900,
          full_name: "Alan Turing",
        }),
      EmployeeAccessError,
    );
  });

  it("blocks access across houses", async () => {
    const repo = createInMemoryEmployeeRepository({
      rows: [buildEmployeeRow("emp-1", { house_id: "house-2" })],
    });

    assert.equal(canManageEmployees(ownerAccess, "house-2"), false);

    await assert.rejects(
      () => updateEmployee(repo, ownerAccess, "emp-1", { full_name: "Restricted" }),
      EmployeeAccessError,
    );
  });

  it("prevents moving employees to another house", async () => {
    const repo = createInMemoryEmployeeRepository({
      rows: [buildEmployeeRow("emp-1", { house_id: "house-1" })],
    });

    await assert.rejects(
      () => updateEmployee(repo, ownerAccess, "emp-1", { house_id: "house-2" }),
      /house/i,
    );
  });

  it("rejects employees assigned to a branch from another house", async () => {
    const repo = createInMemoryEmployeeRepository({ branches: { "branch-2": "house-2" } });

    await assert.rejects(
      () =>
        createEmployee(repo, ownerAccess, {
          house_id: "house-1",
          code: "E-03",
          full_name: "Grace Hopper",
          rate_per_day: 1100,
          branch_id: "branch-2",
        }),
      /branch/i,
    );
  });

  it("filters employees by status, branch, and search", async () => {
    const repo = createInMemoryEmployeeRepository({
      branches: { "branch-1": "house-1", "branch-2": "house-1" },
      rows: [
        buildEmployeeRow("emp-1", { house_id: "house-1", code: "EMP-1", full_name: "Ada", branch_id: "branch-1" }),
        buildEmployeeRow("emp-2", {
          house_id: "house-1",
          code: "EMP-2",
          full_name: "Grace Hopper",
          status: "inactive",
          branch_id: "branch-2",
        }),
        buildEmployeeRow("emp-3", { house_id: "house-2", code: "EMP-3", full_name: "Alan" }),
      ],
    });

    const active = await listEmployees(repo, ownerAccess, { status: "active" });
    assert.deepEqual(active.map((row) => row.id), ["emp-1"]);

    const branchFiltered = await listEmployees(repo, ownerAccess, { branchId: "branch-2" });
    assert.deepEqual(branchFiltered.map((row) => row.id), ["emp-2"]);

    const search = await listEmployees(repo, ownerAccess, { search: "Grace" });
    assert.deepEqual(search.map((row) => row.id), ["emp-2"]);
  });
});
