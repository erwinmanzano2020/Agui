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

class PayslipPdfSupabaseMock {
  runStatus: "draft" | "finalized" | "posted" | "paid" = "finalized";
  referenceCode: string | null = "HR-2024-0001";
  runId = "00000000-0000-0000-0000-000000000010";
  employeeId = "00000000-0000-0000-0000-000000000011";
  houseId = "00000000-0000-0000-0000-000000000012";
  branchId = "00000000-0000-0000-0000-000000000013";
  scheduleId = "00000000-0000-0000-0000-000000000014";

  auth = {
    getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
  };

  buildQuery<T>(data: T) {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      gte: () => query,
      lte: () => query,
      order: () => query,
      maybeSingle: async (): QueryResult<T> => ({ data, error: null }),
      then: <TResult1 = unknown, TResult2 = never>(
        onfulfilled?: (value: { data: T; error: null }) => TResult1 | PromiseLike<TResult1>,
        onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
      ) => Promise.resolve({ data, error: null }).then(onfulfilled, onrejected),
    };
    return query;
  }

  segments = [
    {
      id: "segment-1",
      house_id: this.houseId,
      employee_id: this.employeeId,
      work_date: "2024-01-01",
      time_in: "2024-01-01T09:00:00+08:00",
      time_out: "2024-01-01T17:00:00+08:00",
      hours_worked: 8,
      overtime_minutes: 0,
      source: "manual",
      status: "closed",
      created_at: "2024-01-01T17:00:00.000Z",
    },
  ];

  from(table: string) {
    if (table === "dtr_segments") {
      return this.buildQuery(this.segments);
    }

    if (table === "hr_payroll_runs") {
      return this.buildQuery({
        id: this.runId,
        house_id: this.houseId,
        period_start: "2024-01-01",
        period_end: "2024-01-01",
        status: this.runStatus,
        reference_code: this.referenceCode,
        finalized_at: "2024-01-02T10:00:00.000Z",
        posted_at: "2024-01-03T10:00:00.000Z",
        paid_at: "2024-01-04T10:00:00.000Z",
      });
    }

    if (table === "hr_payroll_run_items") {
      return this.buildQuery([
        {
          id: "run-item-1",
          run_id: this.runId,
          house_id: this.houseId,
          employee_id: this.employeeId,
          work_minutes: 480,
          overtime_minutes_raw: 30,
          overtime_minutes_rounded: 30,
          missing_schedule_days: 0,
          open_segment_days: 0,
          corrected_segment_days: 0,
          notes: {},
          created_at: "2024-01-02T00:00:00.000Z",
        },
      ]);
    }

    if (table === "hr_payroll_run_deductions") {
      return this.buildQuery([
        {
          id: "deduction-1",
          run_id: this.runId,
          house_id: this.houseId,
          employee_id: this.employeeId,
          label: "Cash advance",
          amount: 250,
          created_by: "user-1",
          created_at: "2024-01-02T00:00:00.000Z",
        },
      ]);
    }

    if (table === "employees") {
      const employee = {
        id: this.employeeId,
        house_id: this.houseId,
        branch_id: this.branchId,
        full_name: "Jamie Santos",
        code: "EMP-010",
        rate_per_day: 1000,
      };

      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: async () => ({ data: [employee], error: null }),
        maybeSingle: async () => ({ data: employee, error: null }),
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
let supabase: PayslipPdfSupabaseMock;

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
  supabase = new PayslipPdfSupabaseMock();

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

describe("GET /api/hr/payroll-runs/[id]/payslips/[employeeId]/pdf", () => {
  it("blocks draft payroll runs", async () => {
    supabase.runStatus = "draft";
    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/payslips/${supabase.employeeId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId, employeeId: supabase.employeeId }) },
    );

    assert.equal(response.status, 409);
  });

  it("denies access when HR scope is missing", async () => {
    const accessModule = await import("@/lib/hr/access");
    mock.method(accessModule, "requireHrAccess", async () => ({ ...allowedAccess, allowed: false }));

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/payslips/${supabase.employeeId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId, employeeId: supabase.employeeId }) },
    );

    assert.equal(response.status, 403);
  });

  it("returns a PDF payload for finalized/posted/paid runs", async () => {
    const statuses: Array<"finalized" | "posted" | "paid"> = ["finalized", "posted", "paid"];

    for (const status of statuses) {
      supabase.runStatus = status;
      const response = await GET(
        new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/payslips/${supabase.employeeId}/pdf`) as NextRequest,
        { params: Promise.resolve({ id: supabase.runId, employeeId: supabase.employeeId }) },
      );

      assert.equal(response.status, 200);
      const contentType = response.headers.get("content-type");
      assert.ok(contentType?.includes("application/pdf"));

      const buffer = await response.arrayBuffer();
      assert.ok(buffer.byteLength > 0);
    }
  });

  it("includes the reference code in the filename", async () => {
    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${supabase.runId}/payslips/${supabase.employeeId}/pdf`) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId, employeeId: supabase.employeeId }) },
    );

    assert.equal(response.status, 200);
    const contentDisposition = response.headers.get("content-disposition") ?? "";
    assert.ok(contentDisposition.includes(`Payslip-${supabase.referenceCode}`));
  });

  it("includes undertime deductions in the PDF output", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/hr/payroll-runs/${supabase.runId}/payslips/${supabase.employeeId}/pdf`,
      ) as NextRequest,
      { params: Promise.resolve({ id: supabase.runId, employeeId: supabase.employeeId }) },
    );

    assert.equal(response.status, 200);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    assert.ok(text.includes("Undertime deduction"));
  });
});
