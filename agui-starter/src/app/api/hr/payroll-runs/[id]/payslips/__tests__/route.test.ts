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
  });
});
