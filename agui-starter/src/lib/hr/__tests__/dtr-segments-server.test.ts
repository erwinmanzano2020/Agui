import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DtrSegmentRow, EmployeeRow } from "@/lib/db.types";
import { listDtrByEmployee, listDtrByHouseAndDate, listDtrTodayByBranch } from "../dtr-segments-server";

type Filter<T> = (row: T) => boolean;
type SortInstruction<T> = { column: keyof T; ascending: boolean };

class QueryMock<T extends Record<string, unknown>> {
  constructor(
    private rows: T[],
    private filters: Filter<T>[] = [],
    private sorts: SortInstruction<T>[] = [],
    private resultError: { message: string } | null = null,
  ) {}

  select() {
    return this;
  }

  eq(column: keyof T, value: unknown) {
    return new QueryMock(this.rows, [...this.filters, (row) => row[column] === value], this.sorts, this.resultError);
  }

  gte(column: keyof T, value: string) {
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => String(row[column] ?? "") >= value],
      this.sorts,
      this.resultError,
    );
  }

  lte(column: keyof T, value: string) {
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => String(row[column] ?? "") <= value],
      this.sorts,
      this.resultError,
    );
  }

  in(column: keyof T, values: string[]) {
    const allowed = new Set(values.map(String));
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => allowed.has(String(row[column]))],
      this.sorts,
      this.resultError,
    );
  }

  order(column: keyof T, options: { ascending?: boolean } = {}) {
    return new QueryMock(
      this.rows,
      this.filters,
      [...this.sorts, { column, ascending: options.ascending !== false }],
      this.resultError,
    );
  }

  async maybeSingle<U>() {
    const filtered = this.applyFilters();
    return { data: (filtered[0] as U | null) ?? null, error: this.resultError } as const;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: (value: { data: T[]; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) {
    const payload = { data: this.sortRows(this.applyFilters()), error: this.resultError } as const;
    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }

  private applyFilters(): T[] {
    return this.rows.filter((row) => this.filters.every((filter) => filter(row)));
  }

  private sortRows(rows: T[]): T[] {
    if (!this.sorts.length) return rows;
    return rows.slice().sort((a, b) => {
      for (const instruction of this.sorts) {
        const aVal = a[instruction.column];
        const bVal = b[instruction.column];
        if (aVal === bVal) continue;
        const aStr = String(aVal ?? "");
        const bStr = String(bVal ?? "");
        if (aStr === bStr) continue;
        return (aStr > bStr ? 1 : -1) * (instruction.ascending ? 1 : -1);
      }
      return 0;
    });
  }
}

class SupabaseMock {
  constructor(
    private segments: DtrSegmentRow[],
    private employees: EmployeeRow[],
    private options: { segmentError?: { message: string } | null; employeeError?: { message: string } | null } = {},
  ) {}

  from(table: string) {
    if (table === "dtr_segments") {
      return new QueryMock(this.segments, [], [], this.options.segmentError ?? null);
    }
    if (table === "employees") {
      return new QueryMock(this.employees, [], [], this.options.employeeError ?? null);
    }
    throw new Error(`Unexpected table ${table}`);
  }
}

function buildSegment(id: string, overrides: Partial<DtrSegmentRow> = {}): DtrSegmentRow {
  return {
    id,
    house_id: overrides.house_id ?? "house-1",
    employee_id: overrides.employee_id ?? "emp-1",
    work_date: overrides.work_date ?? "2024-10-01",
    time_in: overrides.time_in ?? "2024-10-01T08:00:00Z",
    time_out: overrides.time_out ?? "2024-10-01T16:00:00Z",
    hours_worked: overrides.hours_worked ?? 8,
    overtime_minutes: overrides.overtime_minutes ?? 0,
    source: overrides.source ?? "manual",
    status: overrides.status ?? "open",
    created_at: overrides.created_at ?? "2024-10-01T16:00:00Z",
  } satisfies DtrSegmentRow;
}

function buildEmployee(id: string, houseId: string, branchId: string | null = null): EmployeeRow {
  return {
    id,
    house_id: houseId,
    code: `EMP-${id}`,
    entity_id: null,
    full_name: `Employee ${id}`,
    rate_per_day: 1000,
    status: "active",
    branch_id: branchId,
    created_at: "2024-10-01T00:00:00Z",
    updated_at: "2024-10-01T00:00:00Z",
  } satisfies EmployeeRow;
}

describe("dtr segment server helpers", () => {
  it("returns empty results when no DTR segments exist for the house and date", async () => {
    const supabase = new SupabaseMock([], [buildEmployee("emp-1", "house-1")]);

    const rows = await listDtrByHouseAndDate(supabase as never, "house-1", "2024-10-02");

    assert.deepEqual(rows, []);
  });

  it("keeps DTR results scoped to the employee's house", async () => {
    const supabase = new SupabaseMock(
      [
        buildSegment("seg-1", { house_id: "house-1", employee_id: "emp-1", work_date: "2024-10-01" }),
        buildSegment("seg-2", { house_id: "house-2", employee_id: "emp-1", work_date: "2024-10-01" }),
      ],
      [buildEmployee("emp-1", "house-1")],
    );

    const rows = await listDtrByEmployee(supabase as never, "emp-1", { start: "2024-10-01", end: "2024-10-02" });

    assert.deepEqual(rows.map((row) => row.id), ["seg-1"]);
  });

  it("returns an empty array when the employee is not accessible", async () => {
    const supabase = new SupabaseMock([buildSegment("seg-3", { employee_id: "emp-missing" })], []);

    const rows = await listDtrByEmployee(supabase as never, "emp-missing", { start: "2024-10-01", end: "2024-10-05" });

    assert.deepEqual(rows, []);
  });

  it("filters branch DTR to today's entries within the same house", async () => {
    const employees = [
      buildEmployee("emp-1", "house-1", "branch-1"),
      buildEmployee("emp-2", "house-1", "branch-1"),
      buildEmployee("emp-3", "house-2", "branch-1"),
    ];
    const segments = [
      buildSegment("seg-a", {
        employee_id: "emp-1",
        house_id: "house-1",
        work_date: "2024-10-05",
        time_in: "2024-10-05T08:00:00Z",
      }),
      buildSegment("seg-b", {
        employee_id: "emp-2",
        house_id: "house-1",
        work_date: "2024-10-04",
        time_in: "2024-10-04T08:00:00Z",
      }),
      buildSegment("seg-c", {
        employee_id: "emp-3",
        house_id: "house-2",
        work_date: "2024-10-05",
        time_in: "2024-10-05T09:00:00Z",
      }),
    ];
    const supabase = new SupabaseMock(segments, employees);

    const rows = await listDtrTodayByBranch(supabase as never, "branch-1", { today: "2024-10-05" });

    assert.deepEqual(rows.map((row) => row.id), ["seg-a"]);
  });

  it("returns an empty list when segment access is denied by RLS", async () => {
    const supabase = new SupabaseMock(
      [buildSegment("seg-1", { house_id: "house-1", work_date: "2024-10-02" })],
      [buildEmployee("emp-1", "house-1")],
      { segmentError: { message: "permission denied for table dtr_segments" } },
    );

    const rows = await listDtrByHouseAndDate(supabase as never, "house-1", "2024-10-02");

    assert.deepEqual(rows, []);
  });

  it("returns an empty list when employee lookup is denied", async () => {
    const supabase = new SupabaseMock(
      [],
      [buildEmployee("emp-1", "house-1")],
      { employeeError: { message: "permission denied for table employees" } },
    );

    const rows = await listDtrByEmployee(supabase as never, "emp-1", { start: "2024-10-01", end: "2024-10-02" });

    assert.deepEqual(rows, []);
  });
});
