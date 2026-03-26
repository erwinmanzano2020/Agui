import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as featureGuard from "@/lib/auth/feature-guard";
import * as identityServer from "@/lib/identity/entity-server";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { EmployeeAccessError } from "@/lib/hr/employees";
import {
  EmployeeBranchNotFoundError,
  EmployeeBranchRequiredError,
} from "@/lib/hr/employees-server";
import {
  assertCanonicalSafeHrRouteEntryOrder,
  assertUnauthenticatedSafeHrRouteDrift,
} from "@/app/api/hr/_shared/__tests__/safe-route-drift";
import { POST } from "../route";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const BRANCH_ID = "11111111-1111-4111-8111-111111111111";

function createSupabaseStub() {
  const stub = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => {
      if (table === "house_roles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { house_id: HOUSE_ID }, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "branches") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: BRANCH_ID }], error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return stub;
}

describe("POST /api/hr/employees boundary error mapping", () => {
  afterEach(() => mock.restoreAll());

  it("returns 401 when unauthenticated", async () => {
    let featureCalls = 0;
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      featureCalls += 1;
      return null;
    });
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      }) as never,
    );

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({}),
      }) as never,
    );

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: "Not authenticated",
      featureGuardCalls: featureCalls,
    });
  });

  it("returns 400 for invalid create payload", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub() as never);
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({ full_name: "A", rate_per_day: -1 }),
      }) as never,
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(String(payload?.error ?? ""), /Fix the highlighted fields/i);
  });

  it("returns 400 when branch_id is missing", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub() as never);
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({ full_name: "No Branch", rate_per_day: 800 }),
      }) as never,
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(String(payload?.error ?? ""), /Fix the highlighted fields/i);
  });

  it("returns 404 when branch does not exist in the house", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub() as never);
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      hasWorkspaceAccess: true,
      allowedByRole: true,
      allowedByPolicy: false,
      roles: ["house_owner"],
      normalizedRoles: ["owner"],
      policyKeys: [],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: false,
      allowedBranchIds: [],
    }) as never);
    mock.method(employeesServer, "createEmployeeForHouseWithAccess", async () => {
      throw new EmployeeBranchNotFoundError("Branch does not exist in this house");
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: "Unknown Branch",
          branch_id: BRANCH_ID,
          rate_per_day: 800,
          entity_id: "22222222-2222-4222-8222-222222222222",
        }),
      }) as never,
    );

    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload?.error, "Branch not found");
  });

  it("returns 403 for authenticated forbidden create", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub() as never);
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      hasWorkspaceAccess: true,
      allowedByRole: false,
      allowedByPolicy: true,
      roles: ["house_staff"],
      normalizedRoles: ["staff"],
      policyKeys: [],
      entityId: "entity-1",
      branchId: BRANCH_ID,
      isBranchLimited: true,
      allowedBranchIds: [BRANCH_ID],
    }) as never);
    mock.method(employeesServer, "createEmployeeForHouseWithAccess", async () => {
      throw new EmployeeAccessError("Not allowed");
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: "Denied Create",
          branch_id: BRANCH_ID,
          rate_per_day: 800,
          entity_id: "22222222-2222-4222-8222-222222222222",
        }),
      }) as never,
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
  });

  it("returns 500 for unexpected create failures", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub() as never);
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      hasWorkspaceAccess: true,
      allowedByRole: true,
      allowedByPolicy: false,
      roles: ["house_owner"],
      normalizedRoles: ["owner"],
      policyKeys: [],
      entityId: "entity-1",
      branchId: BRANCH_ID,
      isBranchLimited: false,
      allowedBranchIds: [],
    }) as never);
    mock.method(employeesServer, "createEmployeeForHouseWithAccess", async () => {
      throw new Error("boom");
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: "Explode",
          branch_id: BRANCH_ID,
          rate_per_day: 800,
          entity_id: "22222222-2222-4222-8222-222222222222",
        }),
      }) as never,
    );

    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload?.error, "Unexpected error while creating employee");
  });

  it("maps domain branch-required failures to 400", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub() as never);
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      hasWorkspaceAccess: true,
      allowedByRole: true,
      allowedByPolicy: false,
      roles: ["house_owner"],
      normalizedRoles: ["owner"],
      policyKeys: [],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: false,
      allowedBranchIds: [],
    }) as never);
    mock.method(employeesServer, "createEmployeeForHouseWithAccess", async () => {
      throw new EmployeeBranchRequiredError("branch_id is required");
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: "No Branch",
          branch_id: BRANCH_ID,
          rate_per_day: 800,
          entity_id: "22222222-2222-4222-8222-222222222222",
        }),
      }) as never,
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(String(payload?.error ?? ""), /Fix the highlighted fields/i);
  });

  it("applies canonical auth -> entity -> feature ordering", async () => {
    const order: string[] = [];
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      order.push("feature");
      return null;
    });
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => {
            order.push("auth");
            return { data: { user: { id: "user-1" } }, error: null };
          },
        },
        from: createSupabaseStub().from,
      }) as never,
    );
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => {
      order.push("entity");
      return "entity-1";
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({ full_name: "A", rate_per_day: -1 }),
      }) as never,
    );

    assert.equal(response.status, 400);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });
});
