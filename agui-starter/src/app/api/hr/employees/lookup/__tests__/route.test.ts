import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as featureGuard from "@/lib/auth/feature-guard";
import * as hrAccess from "@/lib/hr/access";
import * as employeeIdentity from "@/lib/hr/employee-identity";
import * as identityServer from "@/lib/identity/entity-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { AppFeature } from "@/lib/auth/permissions";
import {
  assertCanonicalSafeHrRouteEntryOrder,
  assertUnauthenticatedSafeHrRouteDrift,
} from "@/app/api/hr/_shared/__tests__/safe-route-drift";
import { POST } from "../route";

describe("POST /api/hr/employees/lookup route-entry drift guard", () => {
  afterEach(() => mock.restoreAll());

  it("returns canonical unauthenticated envelope", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) as never,
    );
    const featureMock = mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        body: JSON.stringify({ houseId: "33333333-3333-4333-8333-333333333333" }),
      }) as never,
    );

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: "Not authenticated",
      featureGuardCalls: featureMock.mock.callCount(),
    });
  });

  it("preserves auth -> entity -> feature route-entry ordering", async () => {
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
    const featureMock = mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      order.push("feature");
      return null;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        body: JSON.stringify({}),
      }) as never,
    );

    assert.equal(response.status, 400);
    assertCanonicalSafeHrRouteEntryOrder(order);
    assert.deepEqual(featureMock.mock.calls[0]?.arguments[0], [AppFeature.HR]);
  });

  it("allows add-employee-compatible HR feature users to reach lookup when house access allows", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
        },
      }) as never,
    );
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async (features: AppFeature[]) => {
      assert.deepEqual(features, [AppFeature.HR]);
      return null;
    });
    mock.method(hrAccess, "resolveHrAccess", async () => ({ allowed: true }) as never);
    mock.method(employeeIdentity, "lookupEntitiesForEmployee", async () => []);

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: "33333333-3333-4333-8333-333333333333", email: "none@example.com" }),
      }) as never,
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, { matches: [] });
  });
});
