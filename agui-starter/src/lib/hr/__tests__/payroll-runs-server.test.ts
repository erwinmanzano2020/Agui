import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  HrPayrollRunItemInsert,
  HrPayrollRunItemRow,
  HrPayrollRunRow,
} from "@/lib/db.types";
import { evaluateHrAccess } from "../access";
import {
  createDraftPayrollRunFromPreview,
  getPayrollRunWithItems,
  PayrollRunAccessError,
  PayrollRunMutationError,
} from "../payroll-runs-server";

type QueryResult<T> = { data: T | null; error: { message: string; code?: string } | null };

type Filter<T> = (row: T) => boolean;

type SortInstruction<T> = { column: keyof T; ascending: boolean };

class QueryMock<T extends Record<string, unknown>> {
  constructor(
    protected rows: T[],
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

  order(column: keyof T, options: { ascending?: boolean } = {}) {
    return new QueryMock(
      this.rows,
      this.filters,
      [...this.sorts, { column, ascending: options.ascending !== false }],
    );
  }

  async maybeSingle<U>() {
    const filtered = this.applyFilters();
    return { data: (filtered[0] as U | null) ?? null, error: null } satisfies QueryResult<U>;
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

class RunInsertQueryMock {
  constructor(
    private payload: Partial<HrPayrollRunRow>,
    private result: { run: HrPayrollRunRow | null; error: { message: string; code?: string } | null },
  ) {}

  select() {
    return this;
  }

  async maybeSingle<T>() {
    if (this.result.error) {
      return { data: null, error: this.result.error } satisfies QueryResult<T>;
    }
    const run =
      this.result.run ??
      ({
        id: "run-1",
        house_id: String(this.payload.house_id ?? ""),
        period_start: String(this.payload.period_start ?? ""),
        period_end: String(this.payload.period_end ?? ""),
        status: (this.payload.status as HrPayrollRunRow["status"]) ?? "draft",
        created_by: (this.payload.created_by as string | null) ?? null,
        created_at: "2024-01-01T00:00:00Z",
      } satisfies HrPayrollRunRow);
    this.result.run = run;
    return { data: run as T, error: null } satisfies QueryResult<T>;
  }
}

class RunQueryMock extends QueryMock<HrPayrollRunRow> {
  constructor(
    rows: HrPayrollRunRow[],
    private insertResult: { run: HrPayrollRunRow | null; error: { message: string; code?: string } | null },
  ) {
    super(rows);
  }

  insert(payload: Partial<HrPayrollRunRow>) {
    return new RunInsertQueryMock(payload, this.insertResult);
  }
}

class ItemQueryMock extends QueryMock<HrPayrollRunItemRow> {
  constructor(
    rows: HrPayrollRunItemRow[],
    private insertState: {
      items: HrPayrollRunItemInsert[];
      error: { message: string; code?: string } | null;
      called: boolean;
    },
  ) {
    super(rows);
  }

  async insert(payload: HrPayrollRunItemInsert[]) {
    this.insertState.called = true;
    this.insertState.items.push(...payload);
    return { data: null, error: this.insertState.error } as const;
  }
}

class SupabaseMock {
  constructor(
    private data: {
      runs: HrPayrollRunRow[];
      items: HrPayrollRunItemRow[];
      employees: { id: string; house_id: string; code: string; full_name: string }[];
    },
    private insertState: {
      runResult: { run: HrPayrollRunRow | null; error: { message: string; code?: string } | null };
      itemResult: { items: HrPayrollRunItemInsert[]; error: { message: string; code?: string } | null; called: boolean };
    },
  ) {}

  from(table: string) {
    if (table === "hr_payroll_runs") {
      return new RunQueryMock(this.data.runs, this.insertState.runResult);
    }
    if (table === "hr_payroll_run_items") {
      return new ItemQueryMock(this.data.items, this.insertState.itemResult);
    }
    if (table === "employees") {
      return new QueryMock(this.data.employees);
    }
    throw new Error(`Unexpected table ${table}`);
  }
}

const accessAllowed = evaluateHrAccess({ roles: ["house_owner"], policyKeys: [], entityId: "entity-1" });
const accessDenied = evaluateHrAccess({ roles: [], policyKeys: [], entityId: null });

describe("payroll runs", () => {
  it("creates a draft run and snapshots preview rows", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      { runs: [], items: [], employees: [] },
      { runResult, itemResult },
    );

    const result = await createDraftPayrollRunFromPreview(
      supabase as never,
      {
        houseId: "house-1",
        periodStart: "2024-06-01",
        periodEnd: "2024-06-15",
        createdBy: "entity-1",
      },
      {
        access: accessAllowed,
        previewOverride: {
          period: { startDate: "2024-06-01", endDate: "2024-06-15" },
          rows: [
            {
              employeeId: "emp-1",
              employeeCode: "EMP-1",
              employeeName: "Ada",
              branchId: null,
              workMinutesTotal: 120,
              derivedOtMinutesRawTotal: 30,
              derivedOtMinutesRoundedTotal: 30,
              flags: { missingScheduleDays: 1, openSegmentDays: 0, hasCorrectedSegments: false },
            },
            {
              employeeId: "emp-2",
              employeeCode: "EMP-2",
              employeeName: "Babbage",
              branchId: null,
              workMinutesTotal: 60,
              derivedOtMinutesRawTotal: 10,
              derivedOtMinutesRoundedTotal: 15,
              flags: { missingScheduleDays: 0, openSegmentDays: 1, hasCorrectedSegments: true },
            },
          ],
          summary: {
            employeeCount: 2,
            totalWorkMinutes: 180,
            totalDerivedOtMinutesRaw: 40,
            totalDerivedOtMinutesRounded: 45,
            openSegmentCount: 1,
            missingScheduleCount: 1,
          },
        },
      },
    );

    assert.equal(result.runId, "run-1");
    assert.equal(itemResult.items.length, 2);
    assert.deepEqual(itemResult.items[0], {
      run_id: "run-1",
      house_id: "house-1",
      employee_id: "emp-1",
      work_minutes: 120,
      overtime_minutes_raw: 30,
      overtime_minutes_rounded: 30,
      missing_schedule_days: 1,
      open_segment_days: 0,
      corrected_segment_days: 0,
      notes: {},
    } satisfies HrPayrollRunItemInsert);
    assert.deepEqual(itemResult.items[1], {
      run_id: "run-1",
      house_id: "house-1",
      employee_id: "emp-2",
      work_minutes: 60,
      overtime_minutes_raw: 10,
      overtime_minutes_rounded: 15,
      missing_schedule_days: 0,
      open_segment_days: 1,
      corrected_segment_days: 1,
      notes: { hasCorrectedSegments: true },
    } satisfies HrPayrollRunItemInsert);
  });

  it("denies cross-house access", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      { runs: [], items: [], employees: [] },
      { runResult, itemResult },
    );

    await assert.rejects(
      () =>
        createDraftPayrollRunFromPreview(
          supabase as never,
          {
            houseId: "house-1",
            periodStart: "2024-06-01",
            periodEnd: "2024-06-02",
          },
          {
            access: accessDenied,
            previewOverride: {
              period: { startDate: "2024-06-01", endDate: "2024-06-02" },
              rows: [],
              summary: {
                employeeCount: 0,
                totalWorkMinutes: 0,
                totalDerivedOtMinutesRaw: 0,
                totalDerivedOtMinutesRounded: 0,
                openSegmentCount: 0,
                missingScheduleCount: 0,
              },
            },
          },
        ),
      PayrollRunAccessError,
    );
  });

  it("denies run access when house mismatches", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-2",
            house_id: "house-2",
            period_start: "2024-06-01",
            period_end: "2024-06-15",
            status: "draft",
            created_by: null,
            created_at: "2024-06-02T00:00:00Z",
          },
        ],
        items: [],
        employees: [],
      },
      { runResult, itemResult },
    );

    await assert.rejects(
      () => getPayrollRunWithItems(supabase as never, "house-1", "run-2", { access: accessAllowed }),
      PayrollRunAccessError,
    );
  });

  it("surfaces unique constraint errors on items", async () => {
    const runResult = { run: null, error: null };
    const itemResult = {
      items: [] as HrPayrollRunItemInsert[],
      error: { message: "duplicate", code: "23505" },
      called: false,
    };
    const supabase = new SupabaseMock(
      { runs: [], items: [], employees: [] },
      { runResult, itemResult },
    );

    await assert.rejects(
      () =>
        createDraftPayrollRunFromPreview(
          supabase as never,
          {
            houseId: "house-1",
            periodStart: "2024-06-01",
            periodEnd: "2024-06-02",
          },
          {
            access: accessAllowed,
            previewOverride: {
              period: { startDate: "2024-06-01", endDate: "2024-06-02" },
              rows: [
                {
                  employeeId: "emp-1",
                  employeeCode: "EMP-1",
                  employeeName: "Ada",
                  branchId: null,
                  workMinutesTotal: 60,
                  derivedOtMinutesRawTotal: 10,
                  derivedOtMinutesRoundedTotal: 10,
                  flags: { missingScheduleDays: 0, openSegmentDays: 0, hasCorrectedSegments: false },
                },
              ],
              summary: {
                employeeCount: 1,
                totalWorkMinutes: 60,
                totalDerivedOtMinutesRaw: 10,
                totalDerivedOtMinutesRounded: 10,
                openSegmentCount: 0,
                missingScheduleCount: 0,
              },
            },
          },
        ),
      (error: Error) => error instanceof PayrollRunMutationError && error.code === "23505",
    );
  });

  it("creates a run even when the preview is empty", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      { runs: [], items: [], employees: [] },
      { runResult, itemResult },
    );

    const result = await createDraftPayrollRunFromPreview(
      supabase as never,
      {
        houseId: "house-1",
        periodStart: "2024-06-01",
        periodEnd: "2024-06-01",
      },
      {
        access: accessAllowed,
        previewOverride: {
          period: { startDate: "2024-06-01", endDate: "2024-06-01" },
          rows: [],
          summary: {
            employeeCount: 0,
            totalWorkMinutes: 0,
            totalDerivedOtMinutesRaw: 0,
            totalDerivedOtMinutesRounded: 0,
            openSegmentCount: 0,
            missingScheduleCount: 0,
          },
        },
      },
    );

    assert.equal(result.runId, "run-1");
    assert.equal(itemResult.called, false);
  });
});
