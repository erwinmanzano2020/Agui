import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EmployeeRow } from "@/lib/db.types";
import type { EmployeeListItem } from "../employees-server";
import { listEmployeesForHouse } from "../employees-server";

type QueryResult = { data: EmployeeRow[] | null; error: { message: string } | null };

class EmployeesQueryMock {
  constructor(
    private rows: EmployeeRow[],
    private result: QueryResult = { data: null, error: null },
  ) {}

  select() {
    return this;
  }

  eq(_column: string, houseId: string) {
    const filtered = this.rows.filter((row) => row.house_id === houseId);
    return new EmployeesQueryMock(filtered, this.result);
  }

  order() {
    const sorted = this.rows
      .slice()
      .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
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
  first_name: "Ada",
  last_name: "Lovelace",
  display_name: "Ada Lovelace",
  status: "active",
  employment_type: "full_time",
  branch_id: "branch-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("listEmployeesForHouse", () => {
  it("returns only employees for the requested house sorted by name", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", display_name: "Grace Hopper", branch_id: "branch-1" },
      { ...baseRow, id: "emp-3", display_name: "Alan Turing", house_id: "house-2", branch_id: "branch-2" },
    ]);

    const results = (await listEmployeesForHouse(
      supabase as never,
      "house-1",
      ["branch-1"],
    )) as EmployeeListItem[];

    assert.deepEqual(results.map((row) => row.id), ["emp-1", "emp-2"]);
    assert.ok(results.every((row) => row.display_name));
    assert.ok(results.every((row) => row.branch_id));
  });

  it("returns empty list when no branch ids provided", async () => {
    const supabase = new SupabaseMock([baseRow]);

    const results = await listEmployeesForHouse(supabase as never, "house-1", []);

    assert.deepEqual(results, []);
  });

  it("throws on query errors", async () => {
    const supabase = new SupabaseMock([baseRow], { data: null, error: { message: "boom" } });

    await assert.rejects(() => listEmployeesForHouse(supabase as never, "house-1", ["branch-1"]), /boom/);
  });
});
