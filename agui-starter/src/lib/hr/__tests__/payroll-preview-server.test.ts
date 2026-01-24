import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  DtrSegmentRow,
  EmployeeRow,
  HrBranchScheduleAssignmentRow,
  HrOvertimePolicyRow,
  HrScheduleWindowRow,
} from "@/lib/db.types";
import { evaluateHrAccess } from "../access";
import {
  computePayrollPreviewForHousePeriod,
  PayrollPreviewAccessError,
} from "../payroll-preview-server";
import { computeOvertimeForHouseDate } from "../overtime-engine";

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

  in(column: keyof T, values: string[]) {
    const allowed = new Set(values);
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => allowed.has(String(row[column]))],
      this.sorts,
    );
  }

  gte(column: keyof T, value: string) {
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => String(row[column] ?? "") >= value],
      this.sorts,
    );
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
      windows: HrScheduleWindowRow[];
      policies: HrOvertimePolicyRow[];
      branches: { id: string; house_id: string | null }[];
    },
  ) {}

  from(table: string) {
    if (table === "dtr_segments") return new QueryMock(this.data.segments);
    if (table === "employees") return new QueryMock(this.data.employees);
    if (table === "hr_branch_schedule_assignments") return new QueryMock(this.data.assignments);
    if (table === "hr_schedule_windows") return new QueryMock(this.data.windows);
    if (table === "hr_overtime_policies") return new QueryMock(this.data.policies);
    if (table === "branches") return new QueryMock(this.data.branches);
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

const basePolicy: HrOvertimePolicyRow = {
  house_id: "house-1",
  timezone: "Asia/Manila",
  ot_mode: "AFTER_SCHEDULE_END",
  min_ot_minutes: 10,
  rounding_minutes: 1,
  rounding_mode: "NONE",
  created_at: "2024-01-01T00:00:00Z",
};

function buildSegment(overrides: Partial<DtrSegmentRow> = {}): DtrSegmentRow {
  return {
    id: overrides.id ?? "seg-1",
    house_id: overrides.house_id ?? "house-1",
    employee_id: overrides.employee_id ?? "emp-1",
    work_date: overrides.work_date ?? "2024-10-01",
    time_in: overrides.time_in ?? "2024-10-01T09:00:00+08:00",
    time_out:
      overrides.time_out !== undefined
        ? overrides.time_out
        : "2024-10-01T17:00:00+08:00",
    hours_worked: null,
    overtime_minutes: 0,
    source: "manual",
    status: overrides.status ?? "closed",
    created_at: "2024-10-01T17:00:00Z",
  } satisfies DtrSegmentRow;
}

describe("payroll preview aggregation", () => {
  it("returns empty rows and zero summary for empty periods", async () => {
    const supabase = new SupabaseMock({
      segments: [],
      employees: [baseEmployee],
      assignments: [baseAssignment],
      windows: [baseWindow],
      policies: [basePolicy],
      branches: [{ id: "branch-1", house_id: "house-1" }],
    });

    const result = await computePayrollPreviewForHousePeriod(
      supabase as never,
      { houseId: "house-1", startDate: "2024-10-01", endDate: "2024-10-02" },
      { access: accessAllowed },
    );

    assert.equal(result.rows.length, 0);
    assert.deepEqual(result.summary, {
      employeeCount: 0,
      totalWorkMinutes: 0,
      totalDerivedOtMinutesRaw: 0,
      totalDerivedOtMinutesRounded: 0,
      openSegmentCount: 0,
      missingScheduleCount: 0,
    });
  });

  it("denies cross-house access", async () => {
    const supabase = new SupabaseMock({
      segments: [],
      employees: [{ ...baseEmployee, house_id: "house-2" }],
      assignments: [],
      windows: [],
      policies: [basePolicy],
      branches: [],
    });

    await assert.rejects(
      () =>
        computePayrollPreviewForHousePeriod(
          supabase as never,
          {
            houseId: "house-1",
            startDate: "2024-10-01",
            endDate: "2024-10-02",
            employeeId: "emp-1",
          },
          { access: accessAllowed },
        ),
      PayrollPreviewAccessError,
    );
  });

  it("aggregates multi-segment days correctly", async () => {
    const supabase = new SupabaseMock({
      segments: [
        buildSegment({ id: "seg-1", time_in: "2024-10-01T09:00:00+08:00", time_out: "2024-10-01T12:00:00+08:00" }),
        buildSegment({ id: "seg-2", time_in: "2024-10-01T13:00:00+08:00", time_out: "2024-10-01T18:00:00+08:00" }),
      ],
      employees: [baseEmployee],
      assignments: [baseAssignment],
      windows: [baseWindow],
      policies: [basePolicy],
      branches: [{ id: "branch-1", house_id: "house-1" }],
    });

    const result = await computePayrollPreviewForHousePeriod(
      supabase as never,
      { houseId: "house-1", startDate: "2024-10-01", endDate: "2024-10-01" },
      { access: accessAllowed },
    );

    const row = result.rows[0];
    assert.equal(row.workMinutesTotal, 480);
    assert.equal(row.derivedOtMinutesRawTotal, 60);
    assert.equal(row.derivedOtMinutesRoundedTotal, 60);
    assert.equal(row.flags.missingScheduleDays, 0);
  });

  it("counts missing schedule days", async () => {
    const supabase = new SupabaseMock({
      segments: [
        buildSegment({ id: "seg-1", work_date: "2024-10-01" }),
        buildSegment({ id: "seg-2", work_date: "2024-10-02" }),
      ],
      employees: [baseEmployee],
      assignments: [],
      windows: [],
      policies: [basePolicy],
      branches: [{ id: "branch-1", house_id: "house-1" }],
    });

    const result = await computePayrollPreviewForHousePeriod(
      supabase as never,
      { houseId: "house-1", startDate: "2024-10-01", endDate: "2024-10-02" },
      { access: accessAllowed },
    );

    assert.equal(result.rows[0].flags.missingScheduleDays, 2);
  });

  it("flags open segments without breaking totals", async () => {
    const supabase = new SupabaseMock({
      segments: [
        buildSegment({ id: "seg-1", time_out: null, status: "open" }),
        buildSegment({ id: "seg-2", time_in: "2024-10-01T10:00:00+08:00", time_out: "2024-10-01T14:00:00+08:00" }),
      ],
      employees: [baseEmployee],
      assignments: [baseAssignment],
      windows: [baseWindow],
      policies: [basePolicy],
      branches: [{ id: "branch-1", house_id: "house-1" }],
    });

    const result = await computePayrollPreviewForHousePeriod(
      supabase as never,
      { houseId: "house-1", startDate: "2024-10-01", endDate: "2024-10-01" },
      { access: accessAllowed },
    );

    const row = result.rows[0];
    assert.equal(row.workMinutesTotal, 240);
    assert.equal(row.flags.openSegmentDays, 1);
  });

  it("matches overtime engine totals", async () => {
    const supabase = new SupabaseMock({
      segments: [
        buildSegment({ id: "seg-1", time_in: "2024-10-01T09:00:00+08:00", time_out: "2024-10-01T19:00:00+08:00" }),
      ],
      employees: [baseEmployee],
      assignments: [baseAssignment],
      windows: [baseWindow],
      policies: [basePolicy],
      branches: [{ id: "branch-1", house_id: "house-1" }],
    });

    const preview = await computePayrollPreviewForHousePeriod(
      supabase as never,
      { houseId: "house-1", startDate: "2024-10-01", endDate: "2024-10-01" },
      { access: accessAllowed },
    );

    const overtime = await computeOvertimeForHouseDate(
      supabase as never,
      { houseId: "house-1", workDate: "2024-10-01", employeeIds: ["emp-1"] },
      { access: accessAllowed },
    );

    assert.equal(preview.rows[0].derivedOtMinutesRawTotal, overtime[0].rawOtMinutes);
    assert.equal(preview.rows[0].derivedOtMinutesRoundedTotal, overtime[0].finalOtMinutes);
  });

  it("returns access error when HR access denied", async () => {
    const supabase = new SupabaseMock({
      segments: [],
      employees: [baseEmployee],
      assignments: [baseAssignment],
      windows: [baseWindow],
      policies: [basePolicy],
      branches: [{ id: "branch-1", house_id: "house-1" }],
    });

    await assert.rejects(
      () =>
        computePayrollPreviewForHousePeriod(
          supabase as never,
          { houseId: "house-1", startDate: "2024-10-01", endDate: "2024-10-01" },
          { access: accessDenied },
        ),
      PayrollPreviewAccessError,
    );
  });
});
