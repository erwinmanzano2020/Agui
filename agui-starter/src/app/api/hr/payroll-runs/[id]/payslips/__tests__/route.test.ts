import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import type { NextRequest } from "next/server";
import {
  assertCanonicalSafeHrRouteEntryOrder,
  assertUnauthenticatedSafeHrRouteDrift,
} from "@/app/api/hr/_shared/__tests__/safe-route-drift";

let GET: typeof import("../route").GET;

const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HOUSE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(async () => {
  mock.restoreAll();
  const supabaseService = await import("@/lib/supabase-service");
  mock.method(supabaseService, "getServiceSupabase", () => ({} as never));

  const supabaseServer = await import("@/lib/supabase/server");
  mock.method(supabaseServer, "createServerSupabaseClient", async () =>
    ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never,
  );

  const entityServer = await import("@/lib/identity/entity-server");
  mock.method(entityServer, "resolveEntityIdForUser", async () => "entity-1");

  const featureGuard = await import("@/lib/auth/feature-guard");
  mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

  const payslipServer = await import("@/lib/hr/payslip-server");
  mock.method(payslipServer, "computePayslipsForPayrollRun", async () => []);

  ({ GET } = await import("../route"));
});

afterEach(() => {
  mock.restoreAll();
});

describe("GET /api/hr/payroll-runs/[id]/payslips", () => {
  it("applies canonical auth -> entity -> feature ordering", async () => {
    const order: string[] = [];

    const supabaseServer = await import("@/lib/supabase/server");
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => {
            order.push("auth");
            return { data: { user: { id: "user-1" } }, error: null };
          },
        },
      }) as never,
    );

    const entityServer = await import("@/lib/identity/entity-server");
    mock.method(entityServer, "resolveEntityIdForUser", async () => {
      order.push("entity");
      return "entity-1";
    });

    const featureGuard = await import("@/lib/auth/feature-guard");
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      order.push("feature");
      return null;
    });

    const response = await GET(new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/payslips?houseId=${HOUSE_ID}`) as NextRequest, {
      params: Promise.resolve({ id: RUN_ID }),
    });

    assert.equal(response.status, 200);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });

  it("returns unauthenticated response before parameter validation and feature checks", async () => {
    let featureCalls = 0;

    const supabaseServer = await import("@/lib/supabase/server");
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }) as never,
    );

    const featureGuard = await import("@/lib/auth/feature-guard");
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      featureCalls += 1;
      return null;
    });

    const response = await GET(new Request("http://localhost/api/hr/payroll-runs/not-a-uuid/payslips") as NextRequest, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: "Not authenticated",
      featureGuardCalls: featureCalls,
      payloadParseCalls: 0,
    });
  });

  it("denies access when run belongs to another house (deny-by-default)", async () => {
    const payslipServer = await import("@/lib/hr/payslip-server");
    mock.method(payslipServer, "computePayslipsForPayrollRun", async () => {
      throw new payslipServer.PayslipAccessError("Not allowed");
    });

    const response = await GET(new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/payslips?houseId=${HOUSE_ID}`) as NextRequest, {
      params: Promise.resolve({ id: RUN_ID }),
    });

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.error, "Not allowed");
    assert.equal(payload?.details?.houseId, undefined);
    assert.equal(payload?.details?.runId, undefined);
  });

  it("resolves house scope from payroll run when houseId is omitted", async () => {
    let resolvedHouseId: string | null = null;
    let runLookupCalls = 0;
    const runHouseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    const supabaseService = await import("@/lib/supabase-service");
    mock.method(supabaseService, "getServiceSupabase", () => ({} as never));

    const supabaseServer = await import("@/lib/supabase/server");
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
        },
        from(table: string) {
          if (table !== "hr_payroll_runs") throw new Error(`unexpected table ${table}`);
          return {
            select() {
              return this;
            },
            eq(column: string, value: string) {
              runLookupCalls += 1;
              assert.equal(column, "id");
              assert.equal(value, RUN_ID);
              return this;
            },
            maybeSingle: async () => ({ data: { id: RUN_ID, house_id: runHouseId }, error: null }),
          };
        },
      }) as never,
    );

    const payslipServer = await import("@/lib/hr/payslip-server");
    mock.method(payslipServer, "computePayslipsForPayrollRun", async (_supabase: unknown, input: { houseId: string }) => {
      resolvedHouseId = input.houseId;
      return [];
    });

    const response = await GET(new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/payslips`) as NextRequest, {
      params: Promise.resolve({ id: RUN_ID }),
    });

    assert.equal(response.status, 200);
    assert.equal(resolvedHouseId, runHouseId);
    assert.equal(runLookupCalls, 1);
  });

  it("returns 404 without cross-house details when run cannot be resolved", async () => {
    const supabaseService = await import("@/lib/supabase-service");
    mock.method(supabaseService, "getServiceSupabase", () => ({} as never));

    const supabaseServer = await import("@/lib/supabase/server");
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
        },
        from(table: string) {
          if (table !== "hr_payroll_runs") throw new Error(`unexpected table ${table}`);
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: null, error: null }),
          };
        },
      }) as never,
    );

    const payslipServer = await import("@/lib/hr/payslip-server");
    let computeCalls = 0;
    mock.method(payslipServer, "computePayslipsForPayrollRun", async () => {
      computeCalls += 1;
      return [];
    });

    const response = await GET(new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/payslips`) as NextRequest, {
      params: Promise.resolve({ id: RUN_ID }),
    });

    assert.equal(response.status, 404);
    assert.equal(computeCalls, 0);
    const payload = await response.json();
    assert.equal(payload.error, "Payroll run not found");
    assert.equal(payload?.details?.house_id, undefined);
  });

  it("returns 500 and short-circuits compute when run house lookup fails", async () => {
    const supabaseService = await import("@/lib/supabase-service");
    mock.method(supabaseService, "getServiceSupabase", () => ({} as never));

    const supabaseServer = await import("@/lib/supabase/server");
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
        },
        from(table: string) {
          if (table !== "hr_payroll_runs") throw new Error(`unexpected table ${table}`);
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: null, error: { message: "lookup failed" } }),
          };
        },
      }) as never,
    );

    const payslipServer = await import("@/lib/hr/payslip-server");
    let computeCalls = 0;
    mock.method(payslipServer, "computePayslipsForPayrollRun", async () => {
      computeCalls += 1;
      return [];
    });

    const response = await GET(new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/payslips`) as NextRequest, {
      params: Promise.resolve({ id: RUN_ID }),
    });

    assert.equal(response.status, 500);
    assert.equal(computeCalls, 0);
    const payload = await response.json();
    assert.equal(payload.error, "Failed to load payslips");
    assert.equal(payload?.details?.houseId, undefined);
    assert.equal(payload?.details?.runId, undefined);
  });

  it("uses explicit houseId without fallback lookup widening", async () => {
    let runLookupCalls = 0;
    let resolvedHouseId: string | null = null;

    const supabaseServer = await import("@/lib/supabase/server");
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
        },
        from(table: string) {
          if (table !== "hr_payroll_runs") throw new Error(`unexpected table ${table}`);
          return {
            select() {
              return this;
            },
            eq() {
              runLookupCalls += 1;
              return this;
            },
            maybeSingle: async () => ({ data: { id: RUN_ID, house_id: "should-not-be-used" }, error: null }),
          };
        },
      }) as never,
    );

    const payslipServer = await import("@/lib/hr/payslip-server");
    mock.method(payslipServer, "computePayslipsForPayrollRun", async (_supabase: unknown, input: { houseId: string }) => {
      resolvedHouseId = input.houseId;
      return [];
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/payslips?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 200);
    assert.equal(resolvedHouseId, HOUSE_ID);
    assert.equal(runLookupCalls, 0);
  });
});
