import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import type { NextRequest } from "next/server";
import {
  assertCanonicalSafeHrRouteEntryOrder,
  assertUnauthenticatedSafeHrRouteDrift,
} from "@/app/api/hr/_shared/__tests__/safe-route-drift";

let GET: typeof import("../route").GET;

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const HOUSE_ID = "22222222-2222-4222-8222-222222222222";

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

  const payrollServer = await import("@/lib/hr/payroll-runs-server");
  mock.method(payrollServer, "getPayrollRunWithItems", async () => null);
  const access = await import("@/lib/hr/access");
  mock.method(access, "requireHrAccessWithBranch", async () => ({
    allowed: true,
    allowedByRole: true,
    allowedByPolicy: false,
    hasWorkspaceAccess: true,
    roles: [],
    normalizedRoles: [],
    policyKeys: [],
    entityId: "entity-1",
    branchId: null,
    isBranchLimited: false,
    allowedBranchIds: [],
  }));

  ({ GET } = await import("../route"));
});

afterEach(() => {
  mock.restoreAll();
});

describe("GET /api/hr/payroll-runs/[id]", () => {
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

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 404);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });

  it("returns unauthenticated response before query validation and resolver calls", async () => {
    let featureCalls = 0;
    let getRunCalls = 0;

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

    const payrollServer = await import("@/lib/hr/payroll-runs-server");
    mock.method(payrollServer, "getPayrollRunWithItems", async () => {
      getRunCalls += 1;
      return null;
    });

    const response = await GET(
      new Request("http://localhost/api/hr/payroll-runs/not-a-uuid") as NextRequest,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: "Not authenticated",
      featureGuardCalls: featureCalls,
      payloadParseCalls: 0,
    });
    assert.equal(getRunCalls, 0);
  });

  it("returns 400 when houseId is missing and short-circuits run resolution", async () => {
    let getRunCalls = 0;
    const payrollServer = await import("@/lib/hr/payroll-runs-server");
    mock.method(payrollServer, "getPayrollRunWithItems", async () => {
      getRunCalls += 1;
      return null;
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}`) as NextRequest,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 400);
    assert.equal(getRunCalls, 0);
  });

  it("maps access denial to no-leak forbidden payload", async () => {
    const payrollServer = await import("@/lib/hr/payroll-runs-server");
    mock.method(payrollServer, "getPayrollRunWithItems", async () => {
      throw new payrollServer.PayrollRunAccessError("Not allowed");
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.error, "Not allowed");
    assert.equal(payload?.details?.houseId, undefined);
    assert.equal(payload?.details?.runId, undefined);
  });

  it("short-circuits before run fetch when branch-scoped access denies", async () => {
    let getRunCalls = 0;
    const payrollServer = await import("@/lib/hr/payroll-runs-server");
    mock.method(payrollServer, "getPayrollRunWithItems", async () => {
      getRunCalls += 1;
      return null;
    });
    const access = await import("@/lib/hr/access");
    mock.method(access, "requireHrAccessWithBranch", async () => ({
      allowed: false,
      allowedByRole: false,
      allowedByPolicy: true,
      hasWorkspaceAccess: true,
      roles: [],
      normalizedRoles: [],
      policyKeys: [`hr.branch.${HOUSE_ID}`],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: [HOUSE_ID],
    }));

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 403);
    assert.equal(getRunCalls, 0);
    const payload = await response.json();
    assert.equal(payload.error, "Not allowed");
    assert.equal(payload?.details?.houseId, undefined);
    assert.equal(payload?.details?.runId, undefined);
  });

  it("forwards branch-limited access scope into run read helper", async () => {
    let capturedOptions:
      | { branchScope?: { isBranchLimited: boolean; allowedBranchIds: string[] } }
      | undefined;
    const access = await import("@/lib/hr/access");
    mock.method(access, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      allowedByRole: false,
      allowedByPolicy: true,
      hasWorkspaceAccess: true,
      roles: [],
      normalizedRoles: [],
      policyKeys: [`hr.branch.${HOUSE_ID}`],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: [HOUSE_ID],
    }));

    const payrollServer = await import("@/lib/hr/payroll-runs-server");
    mock.method(
      payrollServer,
      "getPayrollRunWithItems",
      async (
        _supabase: unknown,
        _houseId: string,
        _runId: string,
        options?: { branchScope?: { isBranchLimited: boolean; allowedBranchIds: string[] } },
      ) => {
        capturedOptions = options;
        return null;
      },
    );

    const response = await GET(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 404);
    assert.equal(capturedOptions?.branchScope?.isBranchLimited, true);
    assert.deepEqual(capturedOptions?.branchScope?.allowedBranchIds, [HOUSE_ID]);
  });
});
