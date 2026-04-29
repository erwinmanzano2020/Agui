import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as routeGuard from "@/app/api/hr/_shared/route-guard-order";
import * as hrAccess from "@/lib/hr/access";
import * as employeeIdentity from "@/lib/hr/employee-identity";
import { POST } from "../route";

describe("POST /api/hr/employees/lookup route-entry drift guard", () => {
  afterEach(() => mock.restoreAll());

  it("allows add-employee-compatible actor even without feature entitlement", async () => {
    mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () =>
      ({ supabase: {} as never, userId: "user-1", entityId: "entity-1" }) as never,
    );
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
  });

  it("preserves auth -> entity -> house access ordering", async () => {
    const order: string[] = [];
    mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () => {
      order.push("auth_entity");
      return { supabase: {} as never, userId: "user-1", entityId: "entity-1" } as never;
    });
    mock.method(hrAccess, "resolveHrAccess", async () => {
      order.push("house_access");
      return { allowed: true } as never;
    });
    mock.method(employeeIdentity, "lookupEntitiesForEmployee", async () => {
      order.push("lookup");
      return [];
    });

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: "33333333-3333-4333-8333-333333333333", email: "none@example.com" }),
      }) as never,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(order, ["auth_entity", "house_access", "lookup"]);
  });
});
