import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  DtrSegmentRow,
  EmployeeRow,
  HrBranchScheduleAssignmentRow,
  HrOvertimePolicyRow,
  HrScheduleTemplateRow,
  HrScheduleWindowRow,
} from "@/lib/db.types";
import { evaluateHrAccess } from "../access";
import { getDailyComputedDtrForEmployee } from "../overtime-policy-server";

type Filter<T> = (row: T) => boolean;
type SortInstruction<T> = { column: keyof T; ascending: boolean };

class QueryMock<T extends Record<string, unknown>> {
  constructor(
    private rows: T[],
    private filters: Filter<T>[] = [],
    private sorts: SortInstruction<T>[] = [],
  ) {}

  select() {
    return this;
  }

  eq(column: keyof T, value: unknown) {
    return new QueryMock(this.rows, [...this.filters, (row) => row[column] === value], this.sorts);
  }

  lte(column: keyof T, value: string) {
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => String(row[column] ?? "") <= value],
      this.sorts,
    );
  }

  order(column: keyof T, options: { ascending?: boolean } = {}) {
    return new QueryMock(
      this.rows,
      this.filters,
      [...this.sorts, { column, ascending: options.ascending !== false }],
    );
  }

  async maybeSingle<U>() {
    const filtered = this.applyFilters();
    return { data: (filtered[0] as U | null) ?? null, error: null } as const;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: (value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) {
    const payload = { data: this.sortRows(this.applyFilters()), error: null } as const;
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
    private data: {
      segments: DtrSegmentRow[];
      employees: EmployeeRow[];
      assignments: HrBranchScheduleAssignmentRow[];
      templates: HrScheduleTemplateRow[];
      windows: HrScheduleWindowRow[];
      policies: HrOvertimePolicyRow[];
    },
  ) {}

  from(table: string) {
    if (table === "dtr_segments") return new QueryMock(this.data.segments);
    if (table === "employees") return new QueryMock(this.data.employees);
    if (table === "hr_branch_schedule_assignments") return new QueryMock(this.data.assignments);
    if (table === "hr_schedule_templates") return new QueryMock(this.data.templates);
    if (table === "hr_schedule_windows") return new QueryMock(this.data.windows);
    if (table === "hr_overtime_policies") return new QueryMock(this.data.policies);
    throw new Error(`Unexpected table ${table}`);
  }
}

const accessAllowed = evaluateHrAccess({ roles: ["house_owner"], policyKeys: [], entityId: "entity-1" });
const accessDenied = evaluateHrAccess({ roles: [], policyKeys: [], entityId: null });

const baseEmployee: EmployeeRow = {
  id: "emp-1",
  house_id: "house-1",
  code: "E-001",
  full_name: "Jane Doe",
  status: "active",
  branch_id: "branch-1",
  rate_per_day: 500,
  entity_id: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
};

const baseAssignment: HrBranchScheduleAssignmentRow = {
  id: "assign-1",
  house_id: "house-1",
  branch_id: "branch-1",
  schedule_id: "schedule-1",
  effective_from: "2024-01-01",
  created_at: "2024-01-01T00:00:00Z",
};

const baseTemplate: HrScheduleTemplateRow = {
  id: "schedule-1",
  house_id: "house-1",
  name: "Regular",
  timezone: "Asia/Manila",
  created_at: "2024-01-01T00:00:00Z",
};

const baseWindow: HrScheduleWindowRow = {
  id: "window-1",
  house_id: "house-1",
  schedule_id: "schedule-1",
  day_of_week: 2,
  start_time: "09:00",
  end_time: "17:00",
  break_start: null,
  break_end: null,
  created_at: "2024-01-01T00:00:00Z",
};

describe("getDailyComputedDtrForEmployee", () => {
  it("returns null when access is denied", async () => {
    const supabase = new SupabaseMock({
      segments: [],
      employees: [],
      assignments: [],
      templates: [],
      windows: [],
      policies: [],
    });

    const result = await getDailyComputedDtrForEmployee(
      supabase as never,
      "house-1",
      "emp-1",
      "2024-10-01",
      { access: accessDenied },
    );

    assert.equal(result, null);
  });

  it("computes overtime with default policy when none exists", async () => {
    const supabase = new SupabaseMock({
      segments: [
        {
          id: "seg-1",
          house_id: "house-1",
          employee_id: "emp-1",
          work_date: "2024-10-01",
          time_in: "2024-10-01T09:00:00+08:00",
          time_out: "2024-10-01T18:00:00+08:00",
          hours_worked: null,
          overtime_minutes: 0,
          source: "manual",
          status: "closed",
          created_at: "2024-10-01T18:00:00Z",
        },
      ],
      employees: [baseEmployee],
      assignments: [baseAssignment],
      templates: [baseTemplate],
      windows: [baseWindow],
      policies: [],
    });

    const result = await getDailyComputedDtrForEmployee(
      supabase as never,
      "house-1",
      "emp-1",
      "2024-10-01",
      { access: accessAllowed },
    );

    assert.ok(result);
    assert.equal(result?.overtime_minutes, 60);
    assert.equal(result?.worked_minutes_total, 540);
    assert.deepEqual(result?.warnings ?? [], []);
  });
});
