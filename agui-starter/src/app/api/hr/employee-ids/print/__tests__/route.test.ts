import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import type { NextRequest } from "next/server";
import {
  assertCanonicalSafeHrRouteEntryOrder,
  assertUnauthenticatedSafeHrRouteDrift,
} from "@/app/api/hr/_shared/__tests__/safe-route-drift";

let POST: typeof import("../route").POST;
let runtime: typeof import("../route").runtime;

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest() {
  return new Request("http://localhost/api/hr/employee-ids/print", {
    method: "POST",
    body: JSON.stringify({
      houseId: HOUSE_ID,
      employeeIds: [EMPLOYEE_ID],
    }),
  }) as NextRequest;
}

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
  mock.method(featureGuard, "getFeatureAccessDebugSnapshot", async () => ({
    requiredFeatures: ["hr"],
    resolvedFeatures: ["hr"],
  }));

  const hrAccess = await import("@/lib/hr/access");
  mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
    allowed: true,
    allowedByRole: true,
    allowedByPolicy: false,
    hasWorkspaceAccess: true,
    roles: ["house_manager"],
    normalizedRoles: ["manager"],
    policyKeys: [],
    entityId: "entity-1",
    branchId: null,
    isBranchLimited: false,
    allowedBranchIds: [],
  }) as never);

  const cards = await import("@/lib/hr/employee-id-cards-server");
  mock.method(cards, "listEmployeeIdCards", async () => [
    {
      id: EMPLOYEE_ID,
      code: "EMP-001",
      fullName: "A",
      position: "Cashier",
      branchName: "Main",
      validUntil: null,
      houseId: HOUSE_ID,
      houseName: "Demo House",
      houseBrandName: null,
      houseLogoUrl: null,
    },
  ]);

  const pdf = await import("@/lib/hr/employee-id-card-pdf");
  mock.method(pdf, "generateEmployeeIdCardsSheetPdf", async () => new Uint8Array([1, 2, 3]));

  ({ POST, runtime } = await import("../route"));
});

afterEach(() => {
  mock.restoreAll();
});

describe("POST /api/hr/employee-ids/print", () => {
  it("uses nodejs runtime", () => {
    assert.equal(runtime, "nodejs");
  });

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

    const request = buildRequest() as NextRequest & { json: () => Promise<unknown> };
    const originalJson = request.json.bind(request);
    request.json = async () => {
      order.push("payload");
      return originalJson();
    };

    const response = await POST(request);

    assert.equal(response.status, 200);
    assertCanonicalSafeHrRouteEntryOrder(order, ["payload"]);
  });

  it("returns unauthenticated response before payload validation and without invoking feature guard", async () => {
    let featureCalls = 0;
    let payloadCalls = 0;

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

    const unauthenticatedRequest = {
      json: async () => {
        payloadCalls += 1;
        return { houseId: "bad-house-id", employeeIds: [] };
      },
    } as NextRequest;

    const response = await POST(unauthenticatedRequest);

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 403,
      expectedError: "Not allowed",
      featureGuardCalls: featureCalls,
      payloadParseCalls: payloadCalls,
    });
  });

  it("passes resolved branch scope into list helper", async () => {
    const hrAccess = await import("@/lib/hr/access");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      allowedByRole: false,
      allowedByPolicy: true,
      hasWorkspaceAccess: true,
      roles: ["house_staff"],
      normalizedRoles: ["staff"],
      policyKeys: ["tiles.hr.read", "tiles.hr.branch.44444444-4444-4444-8444-444444444444"],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: ["44444444-4444-4444-8444-444444444444"],
    }) as never);

    const cards = await import("@/lib/hr/employee-id-cards-server");
    let seenScope: unknown = null;
    mock.method(
      cards,
      "listEmployeeIdCards",
      async (
        _supabase: unknown,
        _houseId: string,
        _filters: { branchId?: string | null; search?: string },
        options?: { readScope?: { isBranchLimited?: boolean; allowedBranchIds?: string[] } },
      ) => {
        seenScope = options?.readScope;
        return [
          {
            id: EMPLOYEE_ID,
            code: "EMP-001",
            fullName: "A",
            position: "Cashier",
            branchName: "Main",
            validUntil: null,
            houseId: HOUSE_ID,
            houseName: "Demo House",
            houseBrandName: null,
            houseLogoUrl: null,
          },
        ];
      },
    );

    const response = await POST(buildRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(seenScope, {
      isBranchLimited: true,
      allowedBranchIds: ["44444444-4444-4444-8444-444444444444"],
    });
  });

  it("returns 403 when branch-limited scope resolves to zero allowed branches", async () => {
    const hrAccess = await import("@/lib/hr/access");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: false,
      allowedByRole: false,
      allowedByPolicy: true,
      hasWorkspaceAccess: true,
      roles: ["house_staff"],
      normalizedRoles: ["staff"],
      policyKeys: ["tiles.hr.read"],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: [],
    }) as never);

    const response = await POST(buildRequest());
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, { error: "Not allowed" });
  });
});
