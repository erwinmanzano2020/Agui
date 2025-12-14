import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EmployeeRow } from "@/lib/db.types";
import { listEmployeesByHouse } from "../employees-server";

type QueryResult = { data: EmployeeRow[] | null; error: { message: string } | null };

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
    return new EmployeesQueryMock(sorted, this.result);
  }

  async throwOnError() {
    if (this.result.error) {
      throw new Error(this.result.error.message);
    }
    return { data: this.rows, error: this.result.error } satisfies QueryResult;
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
  employment_type: "full_time",
  branch_id: "branch-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("listEmployeesByHouse", () => {
  it("returns only employees for the requested house sorted by name", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", full_name: "Grace Hopper", code: "EMP-2", branch_id: "branch-1" },
      { ...baseRow, id: "emp-3", full_name: "Alan Turing", code: "EMP-3", house_id: "house-2" },
    ]);

    const results = await listEmployeesByHouse(supabase as never, "house-1");

    assert.deepEqual(
      results.map((row) => row.id),
      ["emp-1", "emp-2"],
    );
    assert.ok(results.every((row) => row.full_name));
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

    assert.deepEqual(results.map((row) => row.id), ["emp-1"]);
  });

  it("blocks branch filters outside the allowed set", async () => {
    const supabase = new SupabaseMock([baseRow]);

    const results = await listEmployeesByHouse(
      supabase as never,
      "house-1",
      { branchId: "branch-x" },
      { allowedBranchIds: ["branch-1"] },
    );

    assert.deepEqual(results, []);
  });

  it("filters by status and search", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", full_name: "Grace Hopper", code: "GH-001", status: "inactive" },
    ]);

    const inactive = await listEmployeesByHouse(supabase as never, "house-1", { status: "inactive" });
    assert.deepEqual(inactive.map((row) => row.id), ["emp-2"]);

    const searchByCode = await listEmployeesByHouse(supabase as never, "house-1", { search: "gh" });
    assert.deepEqual(searchByCode.map((row) => row.id), ["emp-2"]);
  });
});
