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
  createAdjustmentRunForHouse,
  finalizePayrollRunForHouse,
  getPayrollRunWithItems,
  markPayrollRunPaidForHouse,
  PayrollRunAlreadyPostedError,
  PayrollRunAccessError,
  PayrollRunFinalizedError,
  PayrollRunMutationError,
  PayrollRunNotFoundError,
  PayrollRunOpenSegmentsError,
  PayrollRunWrongStatusError,
  postPayrollRunForHouse,
} from "../payroll-runs-server";

type QueryResult<T> = { data: T | null; error: { message: string; code?: string } | null };

type Filter<T> = (row: T) => boolean;

type SortInstruction<T> = { column: keyof T; ascending: boolean };

class QueryMock<T extends Record<string, unknown>> {
  constructor(
    protected rows: T[],
    protected filters: Filter<T>[] = [],
    protected sorts: SortInstruction<T>[] = [],
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

  is(column: keyof T, value: null) {
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => (row[column] ?? null) === value],
      this.sorts,
    );
  }

  not(column: keyof T, operator: "is", value: null) {
    void operator;
    return new QueryMock(
      this.rows,
      [...this.filters, (row) => (row[column] ?? null) !== value],
      this.sorts,
    );
  }

  limit(count: number) {
    const limited = this.applyFilters().slice(0, count);
    return new QueryMock(limited, [], this.sorts);
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

  protected applyFilters(): T[] {
    return this.rows.filter((row) => this.filters.every((filter) => filter(row)));
  }

  protected sortRows(rows: T[]): T[] {
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
        finalized_at: (this.payload.finalized_at as string | null) ?? null,
        finalized_by: (this.payload.finalized_by as string | null) ?? null,
        finalize_note: (this.payload.finalize_note as string | null) ?? null,
        posted_at: (this.payload.posted_at as string | null) ?? null,
        posted_by: (this.payload.posted_by as string | null) ?? null,
        post_note: (this.payload.post_note as string | null) ?? null,
        paid_at: (this.payload.paid_at as string | null) ?? null,
        paid_by: (this.payload.paid_by as string | null) ?? null,
        payment_method: (this.payload.payment_method as string | null) ?? null,
        payment_note: (this.payload.payment_note as string | null) ?? null,
        reference_code: (this.payload.reference_code as string | null) ?? null,
        adjusts_run_id: (this.payload.adjusts_run_id as string | null) ?? null,
      } satisfies HrPayrollRunRow);
    this.result.run = run;
    return { data: run as T, error: null } satisfies QueryResult<T>;
  }
}

class RunUpdateQueryMock {
  constructor(
    private payload: Partial<HrPayrollRunRow>,
    private rows: HrPayrollRunRow[],
    private result: { error: { message: string; code?: string } | null },
    private filters: Filter<HrPayrollRunRow>[] = [],
  ) {}

  eq(column: keyof HrPayrollRunRow, value: unknown) {
    return new RunUpdateQueryMock(this.payload, this.rows, this.result, [
      ...this.filters,
      (row) => row[column] === value,
    ]);
  }

  select() {
    return this;
  }

  async maybeSingle<T>() {
    if (this.result.error) {
      return { data: null, error: this.result.error } satisfies QueryResult<T>;
    }
    const row = this.rows.filter((item) => this.filters.every((filter) => filter(item)))[0] ?? null;
    if (!row) {
      return { data: null, error: null } satisfies QueryResult<T>;
    }
    const updated = { ...row, ...this.payload } satisfies HrPayrollRunRow;
    return { data: updated as T, error: null } satisfies QueryResult<T>;
  }
}

class ItemMutationQueryMock {
  constructor(
    private rows: HrPayrollRunItemRow[],
    private runStatusLookup: (runId: string) => HrPayrollRunRow["status"] | null,
    private filters: Filter<HrPayrollRunItemRow>[] = [],
  ) {}

  eq(column: keyof HrPayrollRunItemRow, value: unknown) {
    return new ItemMutationQueryMock(this.rows, this.runStatusLookup, [
      ...this.filters,
      (row) => row[column] === value,
    ]);
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: (value: { data: null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) {
    const rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    const hasLocked = rows.some((row) => {
      const status = this.runStatusLookup(row.run_id);
      return status === "finalized" || status === "posted" || status === "paid";
    });
    const payload = {
      data: null,
      error: hasLocked ? { message: "Payroll run is locked and cannot be modified" } : null,
    } as const;
    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }
}

class RunQueryMock extends QueryMock<HrPayrollRunRow> {
  constructor(
    rows: HrPayrollRunRow[],
    private insertResult: { run: HrPayrollRunRow | null; error: { message: string; code?: string } | null },
    private updateResult: { error: { message: string; code?: string } | null },
  ) {
    super(rows);
  }

  insert(payload: Partial<HrPayrollRunRow>) {
    return new RunInsertQueryMock(payload, this.insertResult);
  }

  update(payload: Partial<HrPayrollRunRow>) {
    return new RunUpdateQueryMock(payload, this.rows, this.updateResult);
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
    private runStatusLookup: (runId: string) => HrPayrollRunRow["status"] | null,
  ) {
    super(rows);
  }

  async insert(payload: HrPayrollRunItemInsert[]) {
    if (
      payload.some((item) => {
        const status = this.runStatusLookup(item.run_id);
        return status === "finalized" || status === "posted" || status === "paid";
      })
    ) {
      return {
        data: null,
        error: { message: "Payroll run is locked and cannot be modified" },
      } as const;
    }
    this.insertState.called = true;
    this.insertState.items.push(...payload);
    return { data: null, error: this.insertState.error } as const;
  }

  update(_payload: Partial<HrPayrollRunItemRow>) {
    void _payload;
    return new ItemMutationQueryMock(this.rows, this.runStatusLookup, this.filters);
  }

  delete() {
    return new ItemMutationQueryMock(this.rows, this.runStatusLookup, this.filters);
  }
}

class SupabaseMock {
  constructor(
    private data: {
      runs: HrPayrollRunRow[];
      items: HrPayrollRunItemRow[];
      segments: {
        id: string;
        house_id: string;
        employee_id: string;
        work_date: string;
        time_in: string | null;
        time_out: string | null;
        status: "open" | "closed" | "corrected";
      }[];
      employees: { id: string; house_id: string; code: string; full_name: string }[];
    },
    private insertState: {
      runResult: { run: HrPayrollRunRow | null; error: { message: string; code?: string } | null };
      itemResult: { items: HrPayrollRunItemInsert[]; error: { message: string; code?: string } | null; called: boolean };
      runUpdateResult: { error: { message: string; code?: string } | null };
      referenceCounter: Map<number, number>;
    },
  ) {}

  from(table: string) {
    if (table === "hr_payroll_runs") {
      return new RunQueryMock(this.data.runs, this.insertState.runResult, this.insertState.runUpdateResult);
    }
    if (table === "hr_payroll_run_items") {
      const lookup = (runId: string) =>
        this.data.runs.find((run) => run.id === runId)?.status ?? null;
      return new ItemQueryMock(this.data.items, this.insertState.itemResult, lookup);
    }
    if (table === "employees") {
      return new QueryMock(this.data.employees);
    }
    if (table === "dtr_segments") {
      return new QueryMock(this.data.segments);
    }
    throw new Error(`Unexpected table ${table}`);
  }

  async rpc(name: string, args: { target_year?: number }) {
    if (name !== "next_hr_reference_code") {
      return { data: null, error: { message: `Unexpected RPC ${name}` } };
    }
    const year = args.target_year ?? 0;
    const current = this.insertState.referenceCounter.get(year) ?? 0;
    const nextValue = current + 1;
    this.insertState.referenceCounter.set(year, nextValue);
    const reference = `HR-${year}-${String(nextValue).padStart(6, "0")}`;
    return { data: reference, error: null };
  }
}

const accessAllowed = evaluateHrAccess({ roles: ["house_owner"], policyKeys: [], entityId: "entity-1" });
const accessDenied = evaluateHrAccess({ roles: [], policyKeys: [], entityId: null });

describe("payroll runs", () => {
  it("creates a draft run and snapshots preview rows", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      { runs: [], items: [], segments: [], employees: [] },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
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
      { runs: [], items: [], segments: [], employees: [] },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
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
            finalized_at: null,
            finalized_by: null,
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
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
      { runs: [], items: [], segments: [], employees: [] },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
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
      { runs: [], items: [], segments: [], employees: [] },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
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

  it("finalizes a draft run", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-1",
            house_id: "house-1",
            period_start: "2024-06-01",
            period_end: "2024-06-15",
            status: "draft",
            created_by: null,
            created_at: "2024-06-02T00:00:00Z",
            finalized_at: null,
            finalized_by: null,
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [
          {
            id: "item-1",
            run_id: "run-1",
            house_id: "house-1",
            employee_id: "emp-1",
            work_minutes: 60,
            overtime_minutes_raw: 10,
            overtime_minutes_rounded: 10,
            missing_schedule_days: 0,
            open_segment_days: 0,
            corrected_segment_days: 0,
            notes: {},
            created_at: "2024-06-02T00:00:00Z",
          },
        ],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    const result = await finalizePayrollRunForHouse(supabase as never, "house-1", "run-1", {
      access: accessAllowed,
    });

    assert.equal(result.run.status, "finalized");
    assert.equal(result.run.finalizedBy, "entity-1");
    assert.equal(result.itemsCount, 1);
  });

  it("blocks finalizing an already finalized run", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-1",
            house_id: "house-1",
            period_start: "2024-06-01",
            period_end: "2024-06-15",
            status: "finalized",
            created_by: null,
            created_at: "2024-06-02T00:00:00Z",
            finalized_at: "2024-06-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () => finalizePayrollRunForHouse(supabase as never, "house-1", "run-1", { access: accessAllowed }),
      PayrollRunFinalizedError,
    );
  });

  it("denies finalizing a run from another house", async () => {
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
            finalized_at: null,
            finalized_by: null,
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () => finalizePayrollRunForHouse(supabase as never, "house-1", "run-2", { access: accessAllowed }),
      PayrollRunNotFoundError,
    );
  });

  it("blocks item mutation after finalization", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-3",
            house_id: "house-1",
            period_start: "2024-06-01",
            period_end: "2024-06-15",
            status: "finalized",
            created_by: null,
            created_at: "2024-06-02T00:00:00Z",
            finalized_at: "2024-06-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [
          {
            id: "item-1",
            run_id: "run-3",
            house_id: "house-1",
            employee_id: "emp-1",
            work_minutes: 60,
            overtime_minutes_raw: 10,
            overtime_minutes_rounded: 10,
            missing_schedule_days: 0,
            open_segment_days: 0,
            corrected_segment_days: 0,
            notes: {},
            created_at: "2024-06-02T00:00:00Z",
          },
        ],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    const itemQuery = supabase.from("hr_payroll_run_items") as ItemQueryMock;

    const { error: insertError } = await itemQuery.insert([
      {
        run_id: "run-3",
        house_id: "house-1",
        employee_id: "emp-2",
        work_minutes: 10,
        overtime_minutes_raw: 0,
        overtime_minutes_rounded: 0,
        missing_schedule_days: 0,
        open_segment_days: 0,
        corrected_segment_days: 0,
        notes: {},
      },
    ]);
    assert.equal(insertError?.message, "Payroll run is locked and cannot be modified");

    const { error: updateError } = await itemQuery
      .update({ work_minutes: 90 })
      .eq("id", "item-1");
    assert.equal(updateError?.message, "Payroll run is locked and cannot be modified");

    const { error: deleteError } = await itemQuery.delete().eq("id", "item-1");
    assert.equal(deleteError?.message, "Payroll run is locked and cannot be modified");
  });

  it("blocks item mutation after posting", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-4",
            house_id: "house-1",
            period_start: "2024-06-01",
            period_end: "2024-06-15",
            status: "posted",
            created_by: null,
            created_at: "2024-06-02T00:00:00Z",
            finalized_at: "2024-06-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: "2024-06-04T00:00:00Z",
            posted_by: "entity-1",
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: "HR-2024-000004",
            adjusts_run_id: null,
          },
        ],
        items: [
          {
            id: "item-1",
            run_id: "run-4",
            house_id: "house-1",
            employee_id: "emp-1",
            work_minutes: 60,
            overtime_minutes_raw: 10,
            overtime_minutes_rounded: 10,
            missing_schedule_days: 0,
            open_segment_days: 0,
            corrected_segment_days: 0,
            notes: {},
            created_at: "2024-06-02T00:00:00Z",
          },
        ],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    const itemQuery = supabase.from("hr_payroll_run_items") as ItemQueryMock;

    const { error: updateError } = await itemQuery
      .update({ work_minutes: 90 })
      .eq("id", "item-1");
    assert.equal(updateError?.message, "Payroll run is locked and cannot be modified");
  });

  it("posts a finalized run with a reference code", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-10",
            house_id: "house-1",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "finalized",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: "2024-05-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    const result = await postPayrollRunForHouse(
      supabase as never,
      {
        houseId: "house-1",
        runId: "run-10",
        postNote: "Ready to pay",
      },
      { access: accessAllowed },
    );

    assert.equal(result.status, "posted");
    assert.equal(result.referenceCode, "HR-2024-000001");
    assert.equal(result.postedBy, "entity-1");
  });

  it("rejects posting when not finalized", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-11",
            house_id: "house-1",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "draft",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: null,
            finalized_by: null,
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () =>
        postPayrollRunForHouse(supabase as never, { houseId: "house-1", runId: "run-11" }, {
          access: accessAllowed,
        }),
      PayrollRunWrongStatusError,
    );
  });

  it("rejects posting when open segments exist", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-12",
            house_id: "house-1",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "finalized",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: "2024-05-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [
          {
            id: "item-12",
            run_id: "run-12",
            house_id: "house-1",
            employee_id: "emp-1",
            work_minutes: 60,
            overtime_minutes_raw: 0,
            overtime_minutes_rounded: 0,
            missing_schedule_days: 0,
            open_segment_days: 1,
            corrected_segment_days: 0,
            notes: {},
            created_at: "2024-05-02T00:00:00Z",
          },
        ],
        segments: [
          {
            id: "seg-1",
            house_id: "house-1",
            employee_id: "emp-1",
            work_date: "2024-05-02",
            time_in: "2024-05-02T08:00:00Z",
            time_out: null,
            status: "open",
          },
        ],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () =>
        postPayrollRunForHouse(supabase as never, { houseId: "house-1", runId: "run-12" }, {
          access: accessAllowed,
        }),
      PayrollRunOpenSegmentsError,
    );
  });

  it("blocks finalize when open segments exist for employees outside the run items", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-19",
            house_id: "house-1",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "draft",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: null,
            finalized_by: null,
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [
          {
            id: "item-19",
            run_id: "run-19",
            house_id: "house-1",
            employee_id: "emp-1",
            work_minutes: 60,
            overtime_minutes_raw: 0,
            overtime_minutes_rounded: 0,
            missing_schedule_days: 0,
            open_segment_days: 0,
            corrected_segment_days: 0,
            notes: {},
            created_at: "2024-05-02T00:00:00Z",
          },
        ],
        segments: [
          {
            id: "seg-2",
            house_id: "house-1",
            employee_id: "emp-2",
            work_date: "2024-05-10",
            time_in: "2024-05-10T08:00:00Z",
            time_out: null,
            status: "open",
          },
        ],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () => finalizePayrollRunForHouse(supabase as never, "house-1", "run-19", { access: accessAllowed }),
      PayrollRunOpenSegmentsError,
    );
  });

  it("rejects posting when already posted", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-13",
            house_id: "house-1",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "posted",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: "2024-05-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: "2024-05-04T00:00:00Z",
            posted_by: "entity-1",
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: "HR-2024-000001",
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () =>
        postPayrollRunForHouse(supabase as never, { houseId: "house-1", runId: "run-13" }, {
          access: accessAllowed,
        }),
      PayrollRunAlreadyPostedError,
    );
  });

  it("marks a posted run as paid", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-14",
            house_id: "house-1",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "posted",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: "2024-05-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: "2024-05-04T00:00:00Z",
            posted_by: "entity-1",
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: "HR-2024-000002",
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    const result = await markPayrollRunPaidForHouse(
      supabase as never,
      {
        houseId: "house-1",
        runId: "run-14",
        paymentMethod: "Bank transfer",
        paymentNote: "Paid in full",
      },
      { access: accessAllowed },
    );

    assert.equal(result.status, "paid");
    assert.equal(result.paymentMethod, "Bank transfer");
    assert.equal(result.paidBy, "entity-1");
  });

  it("rejects marking paid when not posted", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-15",
            house_id: "house-1",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "finalized",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: "2024-05-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () =>
        markPayrollRunPaidForHouse(supabase as never, { houseId: "house-1", runId: "run-15" }, {
          access: accessAllowed,
        }),
      PayrollRunWrongStatusError,
    );
  });

  it("rejects adjustment runs for mismatched houses", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-16",
            house_id: "house-2",
            period_start: "2024-05-01",
            period_end: "2024-05-15",
            status: "posted",
            created_by: null,
            created_at: "2024-05-02T00:00:00Z",
            finalized_at: "2024-05-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: "2024-05-04T00:00:00Z",
            posted_by: "entity-1",
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: "HR-2024-000003",
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    await assert.rejects(
      () =>
        createAdjustmentRunForHouse(
          supabase as never,
          { houseId: "house-1", adjustsRunId: "run-16" },
          { access: accessAllowed },
        ),
      PayrollRunNotFoundError,
    );
  });

  it("generates unique references for multiple postings in the same year", async () => {
    const runResult = { run: null, error: null };
    const itemResult = { items: [] as HrPayrollRunItemInsert[], error: null, called: false };
    const supabase = new SupabaseMock(
      {
        runs: [
          {
            id: "run-17",
            house_id: "house-1",
            period_start: "2024-06-01",
            period_end: "2024-06-15",
            status: "finalized",
            created_by: null,
            created_at: "2024-06-02T00:00:00Z",
            finalized_at: "2024-06-03T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
          {
            id: "run-18",
            house_id: "house-1",
            period_start: "2024-06-16",
            period_end: "2024-06-30",
            status: "finalized",
            created_by: null,
            created_at: "2024-06-17T00:00:00Z",
            finalized_at: "2024-06-18T00:00:00Z",
            finalized_by: "entity-1",
            finalize_note: null,
            posted_at: null,
            posted_by: null,
            post_note: null,
            paid_at: null,
            paid_by: null,
            payment_method: null,
            payment_note: null,
            reference_code: null,
            adjusts_run_id: null,
          },
        ],
        items: [],
        segments: [],
        employees: [],
      },
      { runResult, itemResult, runUpdateResult: { error: null }, referenceCounter: new Map() },
    );

    const first = await postPayrollRunForHouse(
      supabase as never,
      {
        houseId: "house-1",
        runId: "run-17",
      },
      { access: accessAllowed },
    );
    const second = await postPayrollRunForHouse(
      supabase as never,
      {
        houseId: "house-1",
        runId: "run-18",
      },
      { access: accessAllowed },
    );

    assert.equal(first.referenceCode, "HR-2024-000001");
    assert.equal(second.referenceCode, "HR-2024-000002");
  });
});
