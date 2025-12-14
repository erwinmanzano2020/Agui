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
      first_name: "Ada",
      last_name: "Lovelace",
      branch_id: "branch-1",
    });

    assert.equal(created.display_name, "Ada Lovelace");

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
          first_name: "Alan",
          last_name: "Turing",
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
      () => updateEmployee(repo, ownerAccess, "emp-1", { last_name: "Restricted" }),
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
          first_name: "Grace",
          last_name: "Hopper",
          branch_id: "branch-2",
        }),
      /branch/i,
    );
  });
});
