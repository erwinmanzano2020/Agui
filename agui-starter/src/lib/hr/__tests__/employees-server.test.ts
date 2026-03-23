import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EmployeeRow } from "@/lib/db.types";
import { EmployeeAccessError } from "../employees";
import type { HrAccessDecision } from "../access";
import {
  EmployeeCreateError,
  EmployeeDuplicateIdentityError,
  EmployeeUpdateError,
  createEmployeeForHouseWithAccess,
  deleteEmployeeForHouseWithAccess,
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
  entity_id: null,
  full_name: "Ada Lovelace",
  rate_per_day: 1000,
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

class EmployeeInsertQueryMock {
  constructor(
    private employees: EmployeeRow[],
    private branches: BranchRow[],
    private insertError: { message: string; code?: string; details?: string } | null = null,
    private codeCounters: Map<string, number> = new Map(),
    private filters: Partial<EmployeeRow> = {},
    private mode: "select" | "insert" = "select",
    private pendingInsert: Partial<EmployeeRow> | null = null,
  ) {}

  select() {
    return this;
  }

  eq(column: keyof EmployeeRow, value: string) {
    return new EmployeeInsertQueryMock(
      this.employees,
      this.branches,
      this.insertError,
      this.codeCounters,
      Object.assign({}, this.filters, { [column]: value }),
      this.mode,
      this.pendingInsert,
    );
  }

  limit() {
    return this;
  }

  insert(payload: Partial<EmployeeRow>) {
    return new EmployeeInsertQueryMock(
      this.employees,
      this.branches,
      this.insertError,
      this.codeCounters,
      this.filters,
      "insert",
      payload,
    );
  }

  async maybeSingle<T>() {
    if (this.mode === "select") {
      const match = this.employees.find((row) =>
        Object.entries(this.filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
      );
      return { data: (match as T | null) ?? null, error: null } as const;
    }

    if (this.insertError) {
      return { data: null as T | null, error: this.insertError } as const;
    }

    const payload = this.pendingInsert ?? {};
    const houseId = (payload.house_id as string | undefined) ?? null;
    if (!houseId) {
      throw new Error("house_id is required");
    }

    const next = this.codeCounters.get(houseId) ?? 1;
    const code = payload.code && payload.code.trim().length > 0 ? payload.code : `EI-${String(next).padStart(3, "0")}`;
    this.codeCounters.set(houseId, next + 1);

    const newRow: EmployeeRow = {
      id: payload.id ?? `emp-${this.employees.length + 1}`,
      house_id: houseId,
      code,
      entity_id: (payload.entity_id as string | null | undefined) ?? null,
      full_name: payload.full_name as string,
      rate_per_day: payload.rate_per_day ?? 0,
      status: (payload.status as EmployeeRow["status"]) ?? "active",
      branch_id: (payload.branch_id as string | null) ?? null,
      created_at: payload.created_at ?? "2024-01-02T00:00:00Z",
      updated_at: payload.updated_at ?? "2024-01-02T00:00:00Z",
    };
    this.employees.push(newRow);

    const branch = this.branches.find((b) => b.id === newRow.branch_id) ?? null;
    return {
      data: { ...newRow, branches: branch } as T,
      error: null,
    } as const;
  }
}

class CreateSupabaseMock {
  constructor(
    public employees: EmployeeRow[],
    public branches: BranchRow[],
    private insertError: { message: string; code?: string; details?: string } | null = null,
    private codeCounters: Map<string, number> = new Map(),
  ) {}

  from(table: string) {
    if (table === "employees") {
      return new EmployeeInsertQueryMock(this.employees, this.branches, this.insertError, this.codeCounters);
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
      { readScope: { isBranchLimited: true, allowedBranchIds: allowedBranches } },
    );

    assert.deepEqual(results.employees.map((row) => row.id), ["emp-1"]);
  });

  it("blocks branch filters outside the allowed set", async () => {
    const supabase = new SupabaseMock([baseRow]);

    const results = await listEmployeesByHouse(
      supabase as never,
      "house-1",
      { branchId: "branch-x" },
      { readScope: { isBranchLimited: true, allowedBranchIds: ["branch-1"] } },
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

  it("keeps house-wide visibility for non-branch-limited actors", async () => {
    const supabase = new SupabaseMock([
      { ...baseRow, id: "emp-1", branch_id: "branch-1" },
      { ...baseRow, id: "emp-2", full_name: "Grace Hopper", code: "EMP-2", branch_id: "branch-2" },
      { ...baseRow, id: "emp-3", full_name: "No Branch", code: "EMP-3", branch_id: null },
    ]);

    const result = await listEmployeesByHouse(supabase as never, "house-1", {}, {
      readScope: { isBranchLimited: false, allowedBranchIds: ["branch-1"] },
    });

    assert.deepEqual(result.employees.map((row) => row.id), ["emp-1", "emp-2", "emp-3"]);
  });

  it("narrows branch-limited visibility without denying null-branch employees", async () => {
    const supabase = new SupabaseMock([
      { ...baseRow, id: "emp-1", branch_id: "branch-1" },
      { ...baseRow, id: "emp-2", full_name: "Grace Hopper", code: "EMP-2", branch_id: "branch-2" },
      { ...baseRow, id: "emp-3", full_name: "No Branch", code: "EMP-3", branch_id: null },
    ]);

    const result = await listEmployeesByHouse(supabase as never, "house-1", {}, {
      readScope: { isBranchLimited: true, allowedBranchIds: ["branch-1"] },
    });

    assert.deepEqual(result.employees.map((row) => row.id), ["emp-1", "emp-3"]);
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

  it("returns null for branch-limited actor reading an out-of-scope branch employee", async () => {
    const supabase = new SupabaseMock([baseRow]);

    const employee = await getEmployeeByIdForHouse(supabase as never, "house-1", "emp-1", {
      readScope: { isBranchLimited: true, allowedBranchIds: ["branch-2"] },
    });

    assert.equal(employee, null);
  });
});

describe("createEmployeeForHouseWithAccess", () => {
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

  it("creates an employee within the same house and returns branch details", async () => {
    const supabase = new CreateSupabaseMock([], [{ id: "branch-1", house_id: "house-1", name: "HQ" }]);

    const created = await createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
      full_name: "New Hire",
      status: "active",
      branch_id: "branch-1",
      rate_per_day: 900,
    });

    assert.equal(created.full_name, "New Hire");
    assert.equal(created.branch_id, "branch-1");
    assert.equal(created.house_id, "house-1");
    assert.equal(created.entity_id, null);
    assert.match(created.code, /^EI-\d{3}$/);
    assert.equal(supabase.employees.length, 1);
  });

  it("uses a provided employee id during create", async () => {
    const supabase = new CreateSupabaseMock([], [{ id: "branch-1", house_id: "house-1", name: "HQ" }]);

    const created = await createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
      id: "00000000-0000-4000-8000-000000000555",
      full_name: "ID Locked Hire",
      status: "active",
      branch_id: "branch-1",
      rate_per_day: 900,
    });

    assert.equal(created.id, "00000000-0000-4000-8000-000000000555");
    assert.equal(supabase.employees[0]?.id, "00000000-0000-4000-8000-000000000555");
  });

  it("generates distinct codes per house when code is omitted", async () => {
    const supabase = new CreateSupabaseMock([], [{ id: "branch-1", house_id: "house-1", name: "HQ" }]);

    const first = await createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
      full_name: "First Hire",
      rate_per_day: 800,
    });
    const second = await createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
      full_name: "Second Hire",
      rate_per_day: 900,
    });

    assert.notEqual(first.code, second.code);
    assert.ok(first.code.startsWith("EI-"));
    assert.ok(second.code.startsWith("EI-"));
  });

  it("persists provided entity_id on create", async () => {
    const supabase = new CreateSupabaseMock([], [{ id: "branch-1", house_id: "house-1", name: "HQ" }]);

    const created = await createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
      full_name: "Linked Hire",
      rate_per_day: 950,
      entity_id: "entity-abc",
    });

    assert.equal(created.entity_id, "entity-abc");
    assert.equal(supabase.employees[0].entity_id, "entity-abc");
  });

  it("rejects creation when an active employee already has the same identity in the house", async () => {
    const supabase = new CreateSupabaseMock(
      [
        {
          ...baseRow,
          id: "emp-existing",
          entity_id: "entity-dup",
          status: "active",
        },
      ],
      [{ id: "branch-1", house_id: "house-1", name: "HQ" }],
    );

    await assert.rejects(
      async () =>
        createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
          full_name: "Duplicate Hire",
          rate_per_day: 900,
          entity_id: "entity-dup",
        }),
      (error: unknown) => {
        assert.ok(error instanceof EmployeeDuplicateIdentityError);
        assert.equal(error.employeeId, "emp-existing");
        assert.equal(error.employeeCode, "EMP-1");
        assert.equal(error.employeeName, "Ada Lovelace");
        return true;
      },
    );
    assert.equal(supabase.employees.length, 1);
  });

  it("maps database unique violations to duplicate identity errors", async () => {
    const supabase = new CreateSupabaseMock(
      [],
      [{ id: "branch-1", house_id: "house-1", name: "HQ" }],
      {
        message: 'duplicate key value violates unique constraint "employees_active_identity_per_house_idx"',
        code: "23505",
      },
    );

    let caught: unknown = null;
    try {
      await createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
        full_name: "Race Condition",
        rate_per_day: 900,
        entity_id: "entity-race",
      });
    } catch (error) {
      caught = error;
    }

    assert.ok(
      caught instanceof EmployeeDuplicateIdentityError,
      `Unexpected error type: ${(caught as Error | null)?.constructor?.name ?? "none"} ${(caught as Error | null)?.message ?? ""}`,
    );
    assert.match((caught as Error).message, /active employee/i);
    assert.equal(supabase.employees.length, 0);
  });

  it("allows rehiring when the prior matching identity is inactive", async () => {
    const supabase = new CreateSupabaseMock(
      [
        {
          ...baseRow,
          id: "emp-inactive",
          entity_id: "entity-returning",
          status: "inactive",
        },
      ],
      [{ id: "branch-1", house_id: "house-1", name: "HQ" }],
    );

    const created = await createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
      full_name: "Rehire",
      rate_per_day: 900,
      entity_id: "entity-returning",
    });

    assert.equal(created.entity_id, "entity-returning");
    assert.equal(supabase.employees.length, 2);
  });

  it("raises an error when house_id is missing", async () => {
    const supabase = new CreateSupabaseMock([], []);

    await assert.rejects(
      () =>
        createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "", {
          full_name: "No House",
          rate_per_day: 750,
        }),
      EmployeeCreateError,
    );
  });

  it("rejects creation when the branch belongs to another house", async () => {
    const supabase = new CreateSupabaseMock([], [{ id: "branch-x", house_id: "house-2", name: "Other" }]);

    await assert.rejects(
      () =>
        createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
          full_name: "Wrong Branch",
          rate_per_day: 800,
          branch_id: "branch-x",
        }),
      EmployeeUpdateError,
    );
    assert.equal(supabase.employees.length, 0);
  });

  it("rejects users without HR privileges", async () => {
    const supabase = new CreateSupabaseMock([], []);

    await assert.rejects(
      () =>
        createEmployeeForHouseWithAccess(supabase as never, disallowedAccess, "house-1", {
          full_name: "Blocked Hire",
          rate_per_day: 700,
        }),
      EmployeeAccessError,
    );
  });

  it("surfaces insertion errors", async () => {
    const supabase = new CreateSupabaseMock([], [], { message: "permission denied" });

    await assert.rejects(
      () =>
        createEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", {
          full_name: "Insert Error",
          rate_per_day: 750,
        }),
      EmployeeCreateError,
    );
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


class EmployeeDeleteQueryMock {
  constructor(
    private employees: EmployeeRow[],
    private filters: Partial<EmployeeRow> = {},
    private mode: "select" | "delete" = "select",
  ) {}

  select() {
    return this;
  }

  eq(column: keyof EmployeeRow, value: string) {
    return new EmployeeDeleteQueryMock(this.employees, Object.assign({}, this.filters, { [column]: value }), this.mode);
  }

  delete() {
    return new EmployeeDeleteQueryMock(this.employees, this.filters, "delete");
  }

  async maybeSingle<T>() {
    const match = this.employees.find((row) =>
      Object.entries(this.filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
    );
    return { data: (match as T | null) ?? null, error: null } as const;
  }

  then(resolve: (value: { error: { message: string } | null }) => void) {
    if (this.mode !== "delete") {
      resolve({ error: { message: "invalid mode" } });
      return;
    }

    const index = this.employees.findIndex((row) =>
      Object.entries(this.filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
    );
    if (index >= 0) {
      this.employees.splice(index, 1);
    }

    resolve({ error: null });
  }
}

class DeleteSupabaseMock {
  public removedPaths: string[][] = [];
  public storageError: { message: string } | null = null;

  constructor(public employees: EmployeeRow[]) {}

  from(table: string) {
    if (table !== "employees") {
      throw new Error(`Unexpected table ${table}`);
    }
    return new EmployeeDeleteQueryMock(this.employees);
  }

  storage = {
    from: (bucket: string) => {
      void bucket;
      return {
        remove: async (paths: string[]) => {
          this.removedPaths.push(paths);
          return { error: this.storageError } as const;
        },
      };
    },
  };
}

describe("deleteEmployeeForHouseWithAccess", () => {
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

  it("deletes employee and attempts photo cleanup", async () => {
    const supabase = new DeleteSupabaseMock([
      {
        ...baseRow,
        id: "emp-delete",
        photo_path: "employee-photos/emp-delete.jpg",
      },
    ]);

    const deleted = await deleteEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", "emp-delete");

    assert.equal(deleted, true);
    assert.equal(supabase.employees.length, 0);
    assert.deepEqual(supabase.removedPaths, [["employee-photos/emp-delete.jpg"]]);
  });

  it("continues deletion when storage cleanup fails", async () => {
    const supabase = new DeleteSupabaseMock([
      {
        ...baseRow,
        id: "emp-delete",
        photo_path: "employee-photos/emp-delete.jpg",
      },
    ]);
    supabase.storageError = { message: "boom" };

    const deleted = await deleteEmployeeForHouseWithAccess(supabase as never, allowedAccess, "house-1", "emp-delete");

    assert.equal(deleted, true);
    assert.equal(supabase.employees.length, 0);
  });
});
