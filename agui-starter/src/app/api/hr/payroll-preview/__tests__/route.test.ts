import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as featureGuard from "@/lib/auth/feature-guard";
import * as payrollPreviewServer from "@/lib/hr/payroll-preview-server";
import * as identityServer from "@/lib/identity/entity-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import {
  assertCanonicalSafeHrRouteEntryOrder,
  assertUnauthenticatedSafeHrRouteDrift,
} from "@/app/api/hr/_shared/__tests__/safe-route-drift";
import { GET } from "../route";

describe("GET /api/hr/payroll-preview", () => {
  afterEach(() => mock.restoreAll());

  it("preserves canonical auth -> entity -> feature ordering", async () => {
    const order: string[] = [];
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
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => {
      order.push("entity");
      return "entity-1";
    });
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      order.push("feature");
      return null;
    });
    const computeMock = mock.method(
      payrollPreviewServer,
      "computePayrollPreviewForHousePeriod",
      async () => ({
        period: { startDate: "2026-01-01", endDate: "2026-01-31" },
        rows: [],
        summary: {
          employeeCount: 0,
          totalWorkMinutes: 0,
          totalDerivedOtMinutesRaw: 0,
          totalDerivedOtMinutesRounded: 0,
          openSegmentCount: 0,
          missingScheduleCount: 0,
        },
      }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/hr/payroll-preview?houseId=33333333-3333-4333-8333-333333333333&startDate=2026-01-01&endDate=2026-01-31",
      ) as never,
    );

    assert.equal(response.status, 200);
    assert.equal(computeMock.mock.callCount(), 1);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });

  it("returns unauthenticated boundary before query validation and feature guard", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) as never,
    );
    const featureMock = mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

    const response = await GET(
      new Request(
        "http://localhost/api/hr/payroll-preview?houseId=not-a-uuid&startDate=bad-date&endDate=bad-date",
      ) as never,
    );

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: "Not authenticated",
      featureGuardCalls: featureMock.mock.callCount(),
    });
  });

  it("returns no-leak forbidden payload when payroll preview access resolver denies", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } }) as never,
    );
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(payrollPreviewServer, "computePayrollPreviewForHousePeriod", async () => {
      throw new payrollPreviewServer.PayrollPreviewAccessError(
        "Branch does not belong to this house. houseId=33333333-3333-4333-8333-333333333333",
      );
    });

    const response = await GET(
      new Request(
        "http://localhost/api/hr/payroll-preview?houseId=33333333-3333-4333-8333-333333333333&startDate=2026-01-01&endDate=2026-01-31&branchId=44444444-4444-4444-8444-444444444444",
      ) as never,
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
    assert.equal(payload?.message, undefined);
  });
});
