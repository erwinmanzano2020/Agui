import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { POST } from "../route";

describe("POST /api/hr/employees/lookup authz + response behavior", () => {
  afterEach(() => mock.restoreAll());

  it("returns safe empty result for authorized request with no match", async () => {
    const routeGuard = await import("@/app/api/hr/_shared/route-guard-order");
    const hrAccess = await import("@/lib/hr/access");
    const identity = await import("@/lib/hr/employee-identity");

    mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () =>
      ({ supabase: {} as never, userId: "user-1", entityId: "entity-1" }) as never,
    );
    mock.method(hrAccess, "resolveHrAccess", async () => ({ allowed: true }) as never);
    mock.method(identity, "lookupEntitiesForEmployee", async () => []);

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

  it("returns matches for authorized request", async () => {
    const routeGuard = await import("@/app/api/hr/_shared/route-guard-order");
    const hrAccess = await import("@/lib/hr/access");
    const identity = await import("@/lib/hr/employee-identity");

    mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () =>
      ({ supabase: {} as never, userId: "user-1", entityId: "entity-1" }) as never,
    );
    mock.method(hrAccess, "resolveHrAccess", async () => ({ allowed: true }) as never);
    mock.method(identity, "lookupEntitiesForEmployee", async () => [
      {
        entityId: "44444444-4444-4444-8444-444444444444",
        displayName: "Sample Person",
        matchedIdentifiers: [{ type: "EMAIL", value_masked: "s***@example.com" }],
        matchConfidence: "single",
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: "33333333-3333-4333-8333-333333333333", email: "sample@example.com" }),
      }) as never,
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.matches.length, 1);
    assert.equal(payload.matches[0].entityId, "44444444-4444-4444-8444-444444444444");
  });

  it("denies request when house access is not allowed", async () => {
    const routeGuard = await import("@/app/api/hr/_shared/route-guard-order");
    const hrAccess = await import("@/lib/hr/access");
    const identity = await import("@/lib/hr/employee-identity");

    mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () =>
      ({ supabase: {} as never, userId: "user-1", entityId: "entity-1" }) as never,
    );
    mock.method(hrAccess, "resolveHrAccess", async () => ({ allowed: false }) as never);
    let lookupCalls = 0;
    mock.method(identity, "lookupEntitiesForEmployee", async () => {
      lookupCalls += 1;
      return [];
    });

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: "33333333-3333-4333-8333-333333333333", phone: "+639171234567" }),
      }) as never,
    );

    assert.equal(response.status, 403);
    assert.equal(lookupCalls, 0);
  });

  it("does not assume unique human identity for phone normalization", async () => {
    const identity = await import("@/lib/hr/employee-identity");

    const first = identity.normalizeEmployeePhoneDetails("+63 917 123 4567");
    const second = identity.normalizeEmployeePhoneDetails("09171234567");

    assert.ok(first);
    assert.ok(second);
    assert.equal(first?.e164, second?.e164);
    assert.equal(first?.legacyLocal, second?.legacyLocal);
  });
});
