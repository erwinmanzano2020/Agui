import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

type QueryResult<T> = Promise<{ data: T; error: null }>;

type HrAccessDecision = {
  allowed: boolean;
  allowedByRole: boolean;
  allowedByPolicy: boolean;
  hasWorkspaceAccess: boolean;
  roles: string[];
  normalizedRoles: ("owner" | "manager" | "staff" | "viewer" | "guest" | "unknown")[];
  policyKeys: string[];
  entityId: string | null;
};

class PayrollRunPdfSupabaseMock {
  runStatus: "draft" | "finalized" | "posted" | "paid" = "posted";
  referenceCode: string | null = "HR-2024-0001";
  runId = "00000000-0000-0000-0000-000000001010";
  houseId = "00000000-0000-0000-0000-000000001020";
  branchId = "00000000-0000-0000-0000-000000001030";
  scheduleId = "00000000-0000-0000-0000-000000001040";

  employees = [
    {
      id: "00000000-0000-0000-0000-000000001111",
      house_id: this.houseId,
      branch_id: this.branchId,
      full_name: "Edward Cruz",
      code: "EMP-003",
      rate_per_day: 1000,
    },
    {
      id: "00000000-0000-0000-0000-000000001112",
      house_id: this.houseId,
      branch_id: this.branchId,
      full_name: "Ana Rivera",
      code: "EMP-001",
      rate_per_day: 1000,
    },
    {
      id: "00000000-0000-0000-0000-000000001113",
      house_id: this.houseId,
      branch_id: this.branchId,
      full_name: "Zed Torres",
      code: "EMP-010",
      rate_per_day: 1000,
    },
  ];

  segments = this.employees.map((employee, index) => ({
    id: `segment-${index + 1}`,
    house_id: this.houseId,
    employee_id: employee.id,
    work_date: "2024-01-10",
    time_in: "2024-01-10T09:00:00.000Z",
    time_out: "2024-01-10T17:00:00.000Z",
    hours_worked: 8,
    overtime_minutes: 0,
    source: "manual",
    status: "closed",
    created_at: "2024-01-10T17:00:00.000Z",
  }));

  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: null }>;
  } = {
    getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
  };

  buildQuery<T>(data: T | T[]) {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      in: (column: string, value: unknown[]) => {
        filters[column] = value;
        return query;
      },
      lte: () => query,
      gte: () => query,
      order: () => query,
      maybeSingle: async (): QueryResult<T> => ({
        data: (Array.isArray(data)
          ? this.applyFilters(data, filters)[0] ?? null
          : this.applyFilters([data], filters)[0] ?? null) as T,
        error: null,
      }),
      then: <TResult1 = unknown, TResult2 = never>(
        onfulfilled?: (value: { data: T; error: null }) => TResult1 | PromiseLike<TResult1>,
        onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
      ) =>
        Promise.resolve({
          data: (Array.isArray(data) ? this.applyFilters(data, filters) : []) as T,
          error: null,
        }).then(onfulfilled, onrejected),
    };
    return query;
  }

  applyFilters<T>(data: T[], filters: Record<string, unknown>): T[] {
    return data.filter((row) =>
      Object.entries(filters).every(([key, value]) => {
        if (row == null) return false;
        const rowValue = row[key as keyof typeof row];
        if (Array.isArray(value)) {
          return value.includes(rowValue);
        }
        return rowValue === value;
      }),
    );
  }

  from(table: string) {
    if (table === "dtr_segments") {
      return this.buildQuery(this.segments);
    }

    if (table === "hr_payroll_runs") {
      return this.buildQuery({
        id: this.runId,
        house_id: this.houseId,
        period_start: "2024-01-01",
        period_end: "2024-01-15",
        status: this.runStatus,
        reference_code: this.referenceCode,
        finalized_at: "2024-01-16T10:00:00.000Z",
        posted_at: "2024-01-17T10:00:00.000Z",
        paid_at: "2024-01-18T10:00:00.000Z",
      });
    }

    if (table === "houses") {
      return this.buildQuery({
        id: this.houseId,
        name: "Casa Payroll",
      });
    }

    if (table === "hr_payroll_run_items") {
      return this.buildQuery(
        this.employees.map((employee, index) => ({
          id: `run-item-${index}`,
          run_id: this.runId,
          house_id: this.houseId,
          employee_id: employee.id,
          work_minutes: 480,
          overtime_minutes_raw: 30,
          overtime_minutes_rounded: 30,
          missing_schedule_days: index,
          open_segment_days: index === 2 ? 1 : 0,
          corrected_segment_days: index === 1 ? 1 : 0,
          notes: {},
          created_at: "2024-01-16T00:00:00.000Z",
        })),
      );
    }

    if (table === "hr_payroll_run_deductions") {
      return this.buildQuery([
        {
          id: "deduction-1",
          run_id: this.runId,
          house_id: this.houseId,
          employee_id: this.employees[0].id,
          label: "Cash advance",
          amount: 250,
          created_by: "user-1",
          created_at: "2024-01-16T00:00:00.000Z",
        },
      ]);
    }

    if (table === "employees") {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: async () => ({ data: this.employees, error: null }),
        maybeSingle: async () => ({ data: this.employees[0], error: null }),
      };
      return query;
    }

    if (table === "hr_pay_policies") {
      return this.buildQuery(null);
    }

    if (table === "hr_branch_schedule_assignments") {
      return this.buildQuery([
        {
          id: "assignment-1",
          house_id: this.houseId,
          branch_id: this.branchId,
          schedule_id: this.scheduleId,
          effective_from: "2023-12-01",
          created_at: "2023-12-01T00:00:00.000Z",
        },
      ]);
    }

    if (table === "hr_schedule_windows") {
      return this.buildQuery([
        {
          id: "window-1",
          house_id: this.houseId,
          schedule_id: this.scheduleId,
          day_of_week: 1,
          start_time: "09:00",
          end_time: "18:00",
        },
      ]);
    }

    throw new Error(`Unexpected table: ${table}`);
  }
}

let GET: typeof import("../route").GET;
let supabase: PayrollRunPdfSupabaseMock;

const allowedAccess: HrAccessDecision = {
  allowed: true,
  allowedByRole: true,
  allowedByPolicy: false,
  hasWorkspaceAccess: true,
  roles: [],
  normalizedRoles: [],
  policyKeys: [],
  entityId: "entity-1",
};

beforeEach(async () => {
  supabase = new PayrollRunPdfSupabaseMock();

  const featureGuard = await import("@/lib/auth/feature-guard");
  mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

  const supabaseModule = await import("@/lib/supabase/server");
  mock.method(supabaseModule, "createServerSupabaseClient", async () => supabase);

  const service = await import("@/lib/supabase-service");
  mock.method(service, "getServiceSupabase", () => ({}));

  const entityServer = await import("@/lib/identity/entity-server");
  mock.method(entityServer, "resolveEntityIdForUser", async () => "entity-1");

  const accessModule = await import("@/lib/hr/access");
  mock.method(accessModule, "requireHrAccess", async () => allowedAccess);

  ({ GET } = await import("../route"));
});

afterEach(() => {
  mock.restoreAll();
});

describe("GET /api/hr/payroll-runs/[id]/pdf", () => {
  it("blocks draft payroll runs", async () => {
    supabase.runStatus = "draft";
    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId }) },
    );

    assert.equal(response.status, 409);
  });

  it("denies access when HR scope is missing", async () => {
    const accessModule = await import("@/lib/hr/access");
    mock.method(accessModule, "requireHrAccess", async () => ({ ...allowedAccess, allowed: false }));

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId }) },
    );

    assert.equal(response.status, 403);
  });

  it("returns a PDF payload for finalized/posted/paid runs", async () => {
    const statuses: Array<"finalized" | "posted" | "paid"> = ["finalized", "posted", "paid"];

    for (const status of statuses) {
      supabase.runStatus = status;
      const response = await GET(
        new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/pdf`) as NextRequest,
        { params: Promise.resolve({ id: supabase.runId }) },
      );

      assert.equal(response.status, 200);
      const contentType = response.headers.get("content-type");
      assert.ok(contentType?.includes("application/pdf"));

      const buffer = await response.arrayBuffer();
      assert.ok(buffer.byteLength > 0);
    }
  });

  it("includes register summary text and employee data in the PDF", async () => {
    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId }) },
    );

    assert.equal(response.status, 200);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    assert.ok(text.includes("Register Summary"));
    assert.ok(text.includes("Ana Rivera"));
  });

  it("includes the reference code in the PDF text", async () => {
    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId }) },
    );

    assert.equal(response.status, 200);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    assert.ok(text.includes(supabase.referenceCode ?? ""));
  });

  it("orders payslips by employee name", async () => {
    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId }) },
    );

    assert.equal(response.status, 200);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(buffer));

    const anaIndex = text.indexOf("Ana Rivera");
    const edwardIndex = text.indexOf("Edward Cruz");
    const zedIndex = text.indexOf("Zed Torres");

    assert.ok(anaIndex > -1);
    assert.ok(edwardIndex > -1);
    assert.ok(zedIndex > -1);
    assert.ok(anaIndex < edwardIndex);
    assert.ok(edwardIndex < zedIndex);
  });

  it("returns 401 when unauthenticated", async () => {
    supabase.auth.getUser = async () => ({ data: { user: null }, error: null });

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId }) },
    );

    assert.equal(response.status, 401);
  });
});
