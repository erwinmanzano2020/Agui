import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EmployeeRow } from "@/lib/db.types";
import type { EmployeeListItem } from "../employees-server";
import { listEmployeesForHouse } from "../employees-server";

type EmployeeRowWithBranch = EmployeeRow & { branch_id?: string | null };

type QueryResult = { data: EmployeeRowWithBranch[] | null; error: { message: string } | null };

class EmployeesQueryMock {
  constructor(private rows: EmployeeRowWithBranch[], private result: QueryResult = { data: null, error: null }) {}

  select() {
    return this;
  }

  eq(_column: string, value: string) {
    const filtered = this.rows.filter((row) => row.branch_id === value);
    return new EmployeesQueryMock(filtered, this.result);
  }

  async order() {
    const sorted = this.rows
      .slice()
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    return { data: sorted, error: this.result.error } satisfies QueryResult;
  }
}

class SupabaseMock {
  constructor(private rows: EmployeeRowWithBranch[], private result: QueryResult = { data: null, error: null }) {}

  from(table: string) {
    if (table !== "employees") {
      throw new Error(`Unexpected table ${table}`);
    }
    return new EmployeesQueryMock(this.rows, this.result);
  }
}

const baseRow: EmployeeRowWithBranch = {
  id: "emp-1",
  entity_id: "ent-1",
  brand_id: "brand-1",
  code: "E-01",
  full_name: "Ada Lovelace",
  status: "active",
  rate_per_day: 1000,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  branch_id: "house-1",
};

describe("listEmployeesForHouse", () => {
  it("returns only employees for the requested house sorted by name", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", code: "E-02", full_name: "Grace Hopper", branch_id: "house-1" },
      { ...baseRow, id: "emp-3", code: "E-03", full_name: "Alan Turing", branch_id: "house-2" },
    ]);

    const results = (await listEmployeesForHouse(supabase as never, "house-1")) as EmployeeListItem[];

    assert.deepEqual(results.map((row) => row.id), ["emp-1", "emp-2"]);
    assert.ok(results.every((row) => row.full_name));
    assert.ok(results.every((row) => row.code !== undefined));
  });

  it("throws on query errors", async () => {
    const supabase = new SupabaseMock([baseRow], { data: null, error: { message: "boom" } });

    await assert.rejects(() => listEmployeesForHouse(supabase as never, "house-1"), /boom/);
  });
});
