import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  EmployeeRow,
  HrBranchScheduleAssignmentRow,
  HrPayPolicyRow,
  HrPayrollRunDeductionRow,
  HrPayrollRunItemRow,
  HrPayrollRunRow,
  HrScheduleWindowRow,
} from "@/lib/db.types";
import { evaluateHrAccess } from "../access";
import {
  computePayslipForPayrollRunEmployee,
  createPayrollRunDeduction,
  getPayPolicyForHouse,
  PayrollRunDeductionFinalizedError,
  PayslipAccessError,
} from "../payslip-server";

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

  insert(payload: Record<string, unknown>) {
    const id = `ded-${this.rows.length + 1}`;
    return new InsertMock(this.rows, { id, ...payload } as T);
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

class InsertMock<T extends Record<string, unknown>> {
  constructor(private rows: T[], private payload: T) {}

  select() {
    return this;
  }

  async maybeSingle<U>() {
    this.rows.push(this.payload);
    return { data: this.payload as U, error: null } as const;
  }
}

type MockData = {
  runs: HrPayrollRunRow[];
  items: HrPayrollRunItemRow[];
  employees: EmployeeRow[];
  deductions: HrPayrollRunDeductionRow[];
  policies: HrPayPolicyRow[];
  assignments: HrBranchScheduleAssignmentRow[];
  windows: HrScheduleWindowRow[];
};

class SupabaseMock {
  constructor(private data: MockData) {}

  from(table: string) {
    if (table === "hr_payroll_runs") return new QueryMock(this.data.runs);
    if (table === "hr_payroll_run_items") return new QueryMock(this.data.items);
    if (table === "employees") return new QueryMock(this.data.employees);
    if (table === "hr_payroll_run_deductions") return new QueryMock(this.data.deductions);
    if (table === "hr_pay_policies") return new QueryMock(this.data.policies);
    if (table === "hr_branch_schedule_assignments") return new QueryMock(this.data.assignments);
    if (table === "hr_schedule_windows") return new QueryMock(this.data.windows);
    return new QueryMock([] as Record<string, unknown>[]);
  }
}

const baseAccess = evaluateHrAccess({
  roles: ["house_owner"],
  policyKeys: [],
  entityId: "entity-1",
});

function buildBaseData(overrides: Partial<MockData> = {}) {
  const houseId = "house-1";
  const runId = "run-1";
  const employeeId = "emp-1";
  const scheduleId = "schedule-1";
  const branchId = "branch-1";

  return {
    runs: [
      {
        id: runId,
        house_id: houseId,
        period_start: "2024-01-01",
        period_end: "2024-01-01",
        status: "draft",
        created_by: null,
        created_at: "2024-01-01T00:00:00Z",
        finalized_at: null,
        finalized_by: null,
        finalize_note: null,
      },
    ],
    items: [
      {
        id: "item-1",
        run_id: runId,
        house_id: houseId,
        employee_id: employeeId,
        work_minutes: 480,
        overtime_minutes_raw: 60,
        overtime_minutes_rounded: 60,
        missing_schedule_days: 0,
        open_segment_days: 0,
        corrected_segment_days: 0,
        notes: {},
        created_at: "2024-01-01T00:00:00Z",
      },
    ],
    employees: [
      {
        id: employeeId,
        house_id: houseId,
        code: "EMP-001",
        entity_id: null,
        full_name: "Ana Reyes",
        rate_per_day: 480,
        status: "active",
        branch_id: branchId,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
    deductions: [],
    policies: [],
    assignments: [
      {
        id: "assign-1",
        house_id: houseId,
        branch_id: branchId,
        schedule_id: scheduleId,
        effective_from: "2023-12-01",
        created_at: "2023-12-01T00:00:00Z",
      },
    ],
    windows: [
      {
        id: "window-1",
        house_id: houseId,
        schedule_id: scheduleId,
        day_of_week: 1,
        start_time: "09:00:00",
        end_time: "17:00:00",
        break_start: null,
        break_end: null,
        created_at: "2023-12-01T00:00:00Z",
      },
    ],
    ...overrides,
  } as MockData;
}

describe("payslip preview", () => {
  it("applies pay policy defaults when missing", async () => {
    const supabase = new SupabaseMock(buildBaseData());
    const policy = await getPayPolicyForHouse(supabase as never, "house-1");

    assert.equal(policy.minutesPerDayDefault, 480);
    assert.equal(policy.deriveMinutesFromSchedule, true);
    assert.equal(policy.otMultiplier, 1.0);
  });

  it("derives schedule minutes when policy enables schedule", async () => {
    const supabase = new SupabaseMock(
      buildBaseData({
        runs: [
          {
            id: "run-1",
            house_id: "house-1",
            period_start: "2024-01-01",
            period_end: "2024-01-02",
            status: "draft",
            created_by: null,
            created_at: "2024-01-01T00:00:00Z",
            finalized_at: null,
            finalized_by: null,
            finalize_note: null,
          },
        ],
        policies: [
          {
            house_id: "house-1",
            minutes_per_day_default: 420,
            derive_minutes_from_schedule: true,
            ot_multiplier: 1.0,
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      }),
    );

    const payslip = await computePayslipForPayrollRunEmployee(
      supabase as never,
      { houseId: "house-1", runId: "run-1", employeeId: "emp-1" },
      { access: baseAccess },
    );

    assert.equal(payslip.scheduledMinutes, 900);
    assert.equal(payslip.flags.missingScheduleDays, 1);
  });

  it("falls back to minutes_per_day_default when schedule derivation is disabled", async () => {
    const supabase = new SupabaseMock(
      buildBaseData({
        runs: [
          {
            id: "run-1",
            house_id: "house-1",
            period_start: "2024-01-01",
            period_end: "2024-01-02",
            status: "draft",
            created_by: null,
            created_at: "2024-01-01T00:00:00Z",
            finalized_at: null,
            finalized_by: null,
            finalize_note: null,
          },
        ],
        policies: [
          {
            house_id: "house-1",
            minutes_per_day_default: 450,
            derive_minutes_from_schedule: false,
            ot_multiplier: 1.0,
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      }),
    );

    const payslip = await computePayslipForPayrollRunEmployee(
      supabase as never,
      { houseId: "house-1", runId: "run-1", employeeId: "emp-1" },
      { access: baseAccess },
    );

    assert.equal(payslip.scheduledMinutes, 900);
    assert.equal(payslip.flags.missingScheduleDays, 0);
  });

  it("uses default OT multiplier of 1.0", async () => {
    const supabase = new SupabaseMock(buildBaseData());

    const payslip = await computePayslipForPayrollRunEmployee(
      supabase as never,
      { houseId: "house-1", runId: "run-1", employeeId: "emp-1" },
      { access: baseAccess },
    );

    assert.equal(payslip.overtimePay, 60);
  });

  it("computes undertime deduction", async () => {
    const supabase = new SupabaseMock(
      buildBaseData({
        items: [
          {
            id: "item-1",
            run_id: "run-1",
            house_id: "house-1",
            employee_id: "emp-1",
            work_minutes: 300,
            overtime_minutes_raw: 0,
            overtime_minutes_rounded: 0,
            missing_schedule_days: 0,
            open_segment_days: 0,
            corrected_segment_days: 0,
            notes: {},
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      }),
    );

    const payslip = await computePayslipForPayrollRunEmployee(
      supabase as never,
      { houseId: "house-1", runId: "run-1", employeeId: "emp-1" },
      { access: baseAccess },
    );

    assert.equal(payslip.undertimeMinutes, 180);
    assert.equal(payslip.undertimeDeduction, 180);
  });

  it("aggregates manual deductions", async () => {
    const supabase = new SupabaseMock(
      buildBaseData({
        deductions: [
          {
            id: "ded-1",
            run_id: "run-1",
            house_id: "house-1",
            employee_id: "emp-1",
            label: "Cash advance",
            amount: 100,
            created_by: "entity-1",
            created_at: "2024-01-02T00:00:00Z",
          },
          {
            id: "ded-2",
            run_id: "run-1",
            house_id: "house-1",
            employee_id: "emp-1",
            label: "Uniform",
            amount: 50,
            created_by: "entity-1",
            created_at: "2024-01-03T00:00:00Z",
          },
        ],
      }),
    );

    const payslip = await computePayslipForPayrollRunEmployee(
      supabase as never,
      { houseId: "house-1", runId: "run-1", employeeId: "emp-1" },
      { access: baseAccess },
    );

    assert.equal(payslip.deductionsTotal, 150);
    assert.equal(payslip.netPay, payslip.grossPay - payslip.undertimeDeduction - 150);
  });

  it("denies access for cross-house requests", async () => {
    const supabase = new SupabaseMock(buildBaseData());

    await assert.rejects(
      () =>
        computePayslipForPayrollRunEmployee(
          supabase as never,
          { houseId: "house-2", runId: "run-1", employeeId: "emp-1" },
          { access: baseAccess },
        ),
      PayslipAccessError,
    );
  });

  it("blocks deductions when payroll run is finalized", async () => {
    const supabase = new SupabaseMock(
      buildBaseData({
        runs: [
          {
            id: "run-1",
            house_id: "house-1",
            period_start: "2024-01-01",
            period_end: "2024-01-01",
            status: "finalized",
            created_by: null,
            created_at: "2024-01-01T00:00:00Z",
            finalized_at: "2024-01-05T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
          },
        ],
      }),
    );

    await assert.rejects(
      () =>
        createPayrollRunDeduction(
          supabase as never,
          {
            runId: "run-1",
            employeeId: "emp-1",
            label: "Cash advance",
            amount: 100,
            createdBy: "entity-1",
          },
          { access: baseAccess },
        ),
      PayrollRunDeductionFinalizedError,
    );
  });
});
