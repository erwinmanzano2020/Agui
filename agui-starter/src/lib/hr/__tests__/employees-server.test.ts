import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EmployeeRow } from "@/lib/db.types";
import { EmployeeAccessError } from "../employees";
import type { HrAccessDecision } from "../access";
import {
  EmployeeUpdateError,
  getEmployeeByIdForHouse,
  listBranchesForHouse,
  listEmployeesByHouse,
  updateEmployeeForHouseWithAccess,
} from "../employees-server";
import { normalizeWorkspaceRole } from "@/lib/workspaces/roles";

type QueryResult = { data: EmployeeRow[] | EmployeeRow | null; error: { message: string } | null };

class EmployeesQueryMock {
  constructor(
    private rows: EmployeeRow[],
    private result: QueryResult = { data: null, error: null },
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: string) {
    const filtered = this.rows.filter((row) => (row as Record<string, unknown>)[column] === value);
    return new EmployeesQueryMock(filtered, this.result);
  }

  or(clause: string) {
    const term = clause.split(".").pop()?.replace(/%/g, "").toLowerCase() ?? "";
    const filtered = this.rows.filter(
      (row) => row.full_name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term),
    );
    return new EmployeesQueryMock(filtered, this.result);
  }

  order() {
    const sorted = this.rows.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
    return Promise.resolve({ data: sorted, error: this.result.error } as const);
  }

  async maybeSingle() {
    if (this.result.error) {
      throw new Error(this.result.error.message);
    }
    const row = this.rows[0];
    return { data: row ?? null, error: this.result.error } satisfies QueryResult;
  }
}

class SupabaseMock {
  constructor(
    private rows: EmployeeRow[],
    private result: QueryResult = { data: null, error: null },
  ) {}

  from(table: string) {
    if (table !== "employees") {
      throw new Error(`Unexpected table ${table}`);
    }
    return new EmployeesQueryMock(this.rows, this.result);
  }
}

const baseRow: EmployeeRow = {
  id: "emp-1",
  house_id: "house-1",
  code: "EMP-1",
  full_name: "Ada Lovelace",
  rate_per_day: 1000,
  first_name: "Ada",
  last_name: "Lovelace",
  display_name: "Ada Lovelace",
  status: "active",
  branch_id: "branch-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

type BranchRow = { id: string; house_id: string; name: string | null };

class BranchListQueryMock {
  constructor(
    private branches: BranchRow[],
    private filters: Partial<BranchRow> = {},
    private result: { error: { message: string } | null } = { error: null },
  ) {}

  select() {
    return this;
  }

  eq(column: keyof BranchRow, value: string) {
    return new BranchListQueryMock(this.branches, Object.assign({}, this.filters, { [column]: value }), this.result);
  }

  async order() {
    const filtered = this.branches
      .filter((branch) =>
        Object.entries(this.filters).every(([key, value]) => (branch as Record<string, unknown>)[key] === value),
      )
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    return { data: filtered, error: this.result.error } as const;
  }
}

class BranchListSupabaseMock {
  constructor(private branches: BranchRow[], private result: { error: { message: string } | null } = { error: null }) {}

  from(table: string) {
    if (table !== "branches") {
      throw new Error(`Unexpected table ${table}`);
    }
    return new BranchListQueryMock(this.branches, {}, this.result);
  }
}

describe("listBranchesForHouse", () => {
  it("returns only branches for the requested house and sorts by name", async () => {
    const supabase = new BranchListSupabaseMock([
      { id: "branch-2", house_id: "house-1", name: "Zeta" },
      { id: "branch-1", house_id: "house-1", name: "Alpha" },
      { id: "branch-x", house_id: "house-2", name: "Other" },
    ]);

    const result = await listBranchesForHouse(supabase as never, "house-1");

    assert.deepEqual(result.branches.map((branch) => branch.id), ["branch-1", "branch-2"]);
    assert.equal(result.error, undefined);
  });

  it("returns an error flag while filtering results when the query fails", async () => {
    const supabase = new BranchListSupabaseMock(
      [{ id: "branch-1", house_id: "house-1", name: "Alpha" }],
      { error: { message: "permission denied" } },
    );

    const result = await listBranchesForHouse(supabase as never, "house-1");

    assert.deepEqual(result.branches.map((branch) => branch.id), ["branch-1"]);
    assert.equal(result.error, "permission denied");
  });
});

class BranchQueryMock {
  constructor(private branches: BranchRow[], private filters: Partial<BranchRow> = {}) {}

  select() {
    return this;
  }

  eq(column: keyof BranchRow, value: string) {
    return new BranchQueryMock(
      this.branches,
      Object.assign({}, this.filters, { [column]: value }),
    );
  }

  async maybeSingle<T>() {
    const row = this.branches.find((branch) =>
      Object.entries(this.filters).every(([key, value]) => (branch as Record<string, unknown>)[key] === value),
    );

    return { data: (row as T | null) ?? null, error: null } as const;
  }
}

class EmployeeUpdateQueryMock {
  constructor(
    private employees: EmployeeRow[],
    private branches: BranchRow[],
    private filters: Partial<EmployeeRow> = {},
    private mode: "select" | "update" = "select",
    private updates: Partial<EmployeeRow> | null = null,
  ) {}

  select() {
    return this;
  }

  eq(column: keyof EmployeeRow, value: string) {
    return new EmployeeUpdateQueryMock(
      this.employees,
      this.branches,
      Object.assign({}, this.filters, { [column]: value }),
      this.mode,
      this.updates,
    );
  }

  update(payload: Partial<EmployeeRow>) {
    return new EmployeeUpdateQueryMock(this.employees, this.branches, this.filters, "update", payload);
  }

  async maybeSingle<T>() {
    const match = this.employees.find((row) =>
      Object.entries(this.filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
    );

    if (!match) {
      return { data: null as T | null, error: null } as const;
    }

    if (this.mode === "update") {
      Object.assign(match, this.updates ?? {});
    }

    const branch = this.branches.find((item) => item.id === match.branch_id) ?? null;

    return { data: { ...match, branches: branch } as T, error: null } as const;
  }
}

class UpdateSupabaseMock {
  constructor(public employees: EmployeeRow[], public branches: BranchRow[]) {}

  from(table: string) {
    if (table === "employees") {
      return new EmployeeUpdateQueryMock(this.employees, this.branches);
    }
    if (table === "branches") {
      return new BranchQueryMock(this.branches);
    }
    throw new Error(`Unexpected table ${table}`);
  }
}

describe("listEmployeesByHouse", () => {
  it("returns only employees for the requested house sorted by name", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", full_name: "Grace Hopper", code: "EMP-2", branch_id: "branch-1" },
      { ...baseRow, id: "emp-3", full_name: "Alan Turing", code: "EMP-3", house_id: "house-2" },
    ]);

    const results = await listEmployeesByHouse(supabase as never, "house-1");

    assert.deepEqual(
      results.employees.map((row) => row.id),
      ["emp-1", "emp-2"],
    );
    assert.ok(results.employees.every((row) => row.full_name));
  });

  it("honors branch filters within the same house", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", full_name: "Grace Hopper", code: "EMP-2", branch_id: "branch-2" },
    ]);

    const allowedBranches = ["branch-1"];
    const results = await listEmployeesByHouse(
      supabase as never,
      "house-1",
      { branchId: "branch-1" },
      { allowedBranchIds: allowedBranches },
    );

    assert.deepEqual(results.employees.map((row) => row.id), ["emp-1"]);
  });

  it("blocks branch filters outside the allowed set", async () => {
    const supabase = new SupabaseMock([baseRow]);

    const results = await listEmployeesByHouse(
      supabase as never,
      "house-1",
      { branchId: "branch-x" },
      { allowedBranchIds: ["branch-1"] },
    );

    assert.deepEqual(results.employees, []);
  });

  it("filters by status and search", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", full_name: "Grace Hopper", code: "GH-001", status: "inactive" },
    ]);

    const inactive = await listEmployeesByHouse(supabase as never, "house-1", { status: "inactive" });
    assert.deepEqual(inactive.employees.map((row) => row.id), ["emp-2"]);

    const searchByCode = await listEmployeesByHouse(supabase as never, "house-1", { search: "gh" });
    assert.deepEqual(searchByCode.employees.map((row) => row.id), ["emp-2"]);
  });

  it("surfaces query errors while returning any partial data", async () => {
    const supabase = new SupabaseMock(
      [baseRow],
      { data: null, error: { message: "permission denied for table employees" } },
    );

    const result = await listEmployeesByHouse(supabase as never, "house-1");

    assert.deepEqual(result.employees.map((row) => row.id), ["emp-1"]);
    assert.equal(result.error, "permission denied for table employees");
  });
});

describe("getEmployeeByIdForHouse", () => {
  it("returns an employee in the same house with branch details", async () => {
    const supabase = new SupabaseMock([
      { ...baseRow, branches: { id: "branch-1", name: "Main Branch", house_id: "house-1" } } as EmployeeRow & {
        branches: { id: string; name: string; house_id: string };
      },
    ]);

    const employee = await getEmployeeByIdForHouse(supabase as never, "house-1", "emp-1");

    assert.ok(employee);
    assert.equal(employee?.branch_name, "Main Branch");
  });

  it("returns null when the employee is outside the current house", async () => {
    const supabase = new SupabaseMock([
      { ...baseRow, house_id: "house-2", branches: { id: "branch-1", name: "Other", house_id: "house-2" } } as EmployeeRow & {
        branches: { id: string; name: string; house_id: string };
      },
    ]);

    const employee = await getEmployeeByIdForHouse(supabase as never, "house-1", "emp-1");

    assert.equal(employee, null);
  });

  it("does not expose branches from other houses", async () => {
    const supabase = new SupabaseMock([
      { ...baseRow, branches: { id: "branch-x", name: "Other House", house_id: "house-2" } } as EmployeeRow & {
        branches: { id: string; name: string; house_id: string };
      },
    ]);

    const employee = await getEmployeeByIdForHouse(supabase as never, "house-1", "emp-1");

    assert.ok(employee);
    assert.equal(employee?.branch_id, null);
    assert.equal(employee?.branch_name, null);
  });
});

describe("updateEmployeeForHouseWithAccess", () => {
  const allowedAccess: HrAccessDecision = {
    allowed: true,
    allowedByPolicy: false,
    allowedByRole: true,
    hasWorkspaceAccess: true,
    normalizedRoles: [normalizeWorkspaceRole("house_owner")],
    policyKeys: [],
    roles: ["house_owner"],
    entityId: "entity-1",
  };

  const disallowedAccess: HrAccessDecision = {
    ...allowedAccess,
    allowed: false,
    allowedByRole: false,
    normalizedRoles: [normalizeWorkspaceRole("house_staff")],
    roles: ["house_staff"],
  };

  it("updates core employee fields within the same house", async () => {
    const supabase = new UpdateSupabaseMock(
      [{ ...baseRow }],
      [{ id: "branch-1", house_id: "house-1", name: "HQ" }],
    );

    const updated = await updateEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", "emp-1", {
      full_name: "Updated Name",
      status: "inactive",
      branch_id: "branch-1",
      rate_per_day: 1500,
    });

    assert.ok(updated);
    assert.equal(updated?.full_name, "Updated Name");
    assert.equal(updated?.status, "inactive");
    assert.equal(updated?.branch_id, "branch-1");
    assert.equal(supabase.employees[0].code, "EMP-1");
  });

  it("returns null when attempting to edit an employee outside the house", async () => {
    const supabase = new UpdateSupabaseMock(
      [{ ...baseRow, house_id: "house-2" }],
      [{ id: "branch-1", house_id: "house-2", name: "Remote" }],
    );

    const result = await updateEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", "emp-1", {
      full_name: "No Change",
      status: "active",
      branch_id: null,
      rate_per_day: 1000,
    });

    assert.equal(result, null);
  });

  it("rejects users without HR privileges", async () => {
    const supabase = new UpdateSupabaseMock([{ ...baseRow }], []);

    await assert.rejects(
      () =>
        updateEmployeeForHouseWithAccess(supabase as never, disallowedAccess, "house-1", "emp-1", {
          full_name: "Blocked",
          status: "active",
          branch_id: null,
          rate_per_day: 900,
        }),
      EmployeeAccessError,
    );
  });

  it("rejects branches from other houses", async () => {
    const supabase = new UpdateSupabaseMock(
      [{ ...baseRow }],
      [{ id: "branch-x", house_id: "house-2", name: "Other" }],
    );

    await assert.rejects(
      () =>
        updateEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", "emp-1", {
          full_name: "Ada Lovelace",
          status: "active",
          branch_id: "branch-x",
          rate_per_day: 1200,
        }),
      EmployeeUpdateError,
    );
  });
});
