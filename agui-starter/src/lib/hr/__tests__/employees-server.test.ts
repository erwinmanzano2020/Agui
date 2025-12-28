import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EmployeeRow } from "@/lib/db.types";
import type { EmployeeListItem } from "../employees-server";
import { listDepartmentIdsForHouse, listEmployeesForHouse } from "../employees-server";

type EmployeeRowWithDepartment = EmployeeRow & { department_id?: string | null };

type QueryResult = { data: EmployeeRowWithDepartment[] | null; error: { message: string } | null };

class EmployeesQueryMock {
  constructor(
    private rows: EmployeeRowWithDepartment[],
    private result: QueryResult = { data: null, error: null },
  ) {}

  select() {
    return this;
  }

  in(_column: string, values: string[]) {
    const filtered = this.rows.filter((row) =>
      values.includes(row.department_id ?? ""),
    );
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
  constructor(
    private rows: EmployeeRowWithDepartment[],
    private result: QueryResult = { data: null, error: null },
  ) {}

  from(table: string) {
    if (table !== "employees") {
      throw new Error(`Unexpected table ${table}`);
    }
    return new EmployeesQueryMock(this.rows, this.result);
  }
}

const baseRow: EmployeeRowWithDepartment = {
  id: "emp-1",
  entity_id: "ent-1",
  brand_id: "brand-1",
  code: "E-01",
  full_name: "Ada Lovelace",
  status: "active",
  rate_per_day: 1000,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  department_id: "house-1",
};

describe("listEmployeesForHouse", () => {
  it("returns only employees for the requested house sorted by name", async () => {
    const supabase = new SupabaseMock([
      baseRow,
      { ...baseRow, id: "emp-2", code: "E-02", full_name: "Grace Hopper", department_id: "house-1" },
      { ...baseRow, id: "emp-3", code: "E-03", full_name: "Alan Turing", department_id: "house-2" },
    ]);

    const results = (await listEmployeesForHouse(supabase as never, ["house-1"])) as EmployeeListItem[];

    assert.deepEqual(results.map((row) => row.id), ["emp-1", "emp-2"]);
    assert.ok(results.every((row) => row.full_name));
    assert.ok(results.every((row) => row.code !== undefined));
    assert.ok(results.every((row) => row.entity_id));
  });

  it("returns empty list when no department ids provided", async () => {
    const supabase = new SupabaseMock([baseRow]);

    const results = await listEmployeesForHouse(supabase as never, []);

    assert.deepEqual(results, []);
  });

  it("throws on query errors", async () => {
    const supabase = new SupabaseMock([baseRow], { data: null, error: { message: "boom" } });

    await assert.rejects(() => listEmployeesForHouse(supabase as never, ["house-1"]), /boom/);
  });

  it("returns the first non-empty department set across supported tables", async () => {
    const supabase = {
      from(table: string) {
        if (table === "departments") {
          return {
            select() {
              return this;
            },
            async eq() {
              return { data: [], error: null };
            },
          };
        }
        if (table === "branches") {
          return {
            select() {
              return this;
            },
            async eq() {
              return { data: [{ id: "branch-1" }, { id: null }], error: null };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    const results = await listDepartmentIdsForHouse(supabase as never, "house-1");

    assert.deepEqual(results, ["branch-1"]);
  });

  it("treats missing department tables as optional metadata", async () => {
    const supabase = {
      from(table: string) {
        if (table === "departments") {
          return {
            select() {
              return this;
            },
            async eq() {
              return { data: null, error: { code: "42P01", message: "missing" } };
            },
          };
        }
        if (table === "branches") {
          return {
            select() {
              return this;
            },
            async eq() {
              return { data: [{ id: "branch-1" }], error: null };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    const results = await listDepartmentIdsForHouse(supabase as never, "house-1");

    assert.deepEqual(results, ["branch-1"]);
  });

  it("throws on unexpected department query errors", async () => {
    const supabase = {
      from(_table: string) {
        void _table;
        return {
          select() {
            return this;
          },
          async eq() {
            return { data: null, error: { code: "XX000", message: "fatal" } };
          },
        };
      },
    };

    await assert.rejects(
      () => listDepartmentIdsForHouse(supabase as never, "house-1"),
      /fatal/,
    );
  });
});
