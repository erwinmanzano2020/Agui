import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as featureGuard from "@/lib/auth/feature-guard";
import * as identityServer from "@/lib/identity/entity-server";
import * as employeeIdentity from "@/lib/hr/employee-identity";
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
import * as routeGuardOrder from "@/app/api/hr/_shared/route-guard-order";
import { GET, POST } from "../route";

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
            eq: (column: string, value: string) => {
              if (column === "house_id") {
                return Promise.resolve({ data: [{ id: BRANCH_ID }], error: null });
              }
              if (column === "id") {
                return {
                  maybeSingle: async () => ({
                    data:
                      value === BRANCH_ID
                        ? { id: BRANCH_ID, house_id: HOUSE_ID, name: "Main" }
                        : null,
                    error: null,
                  }),
                };
              }
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
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
    mock.method(employeesServer, "resolveEmployeeCreateBranchForHouseWithAccess", async () => {
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

  it("does not run identity linking when branch is out of scope", async () => {
    let identityCalls = 0;
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
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: [BRANCH_ID],
    }) as never);
    mock.method(employeesServer, "resolveEmployeeCreateBranchForHouseWithAccess", async () => {
      throw new EmployeeAccessError("Not allowed");
    });
    mock.method(employeeIdentity, "findOrCreateEntityForEmployee", async () => {
      identityCalls += 1;
      return { entityId: "entity-linked" };
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: "Out Scope",
          branch_id: BRANCH_ID,
          rate_per_day: 800,
          email: "test@example.com",
        }),
      }) as never,
    );

    assert.equal(response.status, 403);
    assert.equal(identityCalls, 0);
  });

  it("does not run identity linking when branch does not exist", async () => {
    let identityCalls = 0;
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
    mock.method(employeesServer, "resolveEmployeeCreateBranchForHouseWithAccess", async () => {
      throw new EmployeeBranchNotFoundError("Branch does not exist in this house");
    });
    mock.method(employeeIdentity, "findOrCreateEntityForEmployee", async () => {
      identityCalls += 1;
      return { entityId: "entity-linked" };
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: "Unknown Branch",
          branch_id: BRANCH_ID,
          rate_per_day: 800,
          phone: "+15555555555",
        }),
      }) as never,
    );

    assert.equal(response.status, 404);
    assert.equal(identityCalls, 0);
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
    mock.method(employeesServer, "resolveEmployeeCreateBranchForHouseWithAccess", async () => {
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

  it("runs identity linking after branch gate passes", async () => {
    let identityCalls = 0;
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
    mock.method(employeesServer, "resolveEmployeeCreateBranchForHouseWithAccess", async () => BRANCH_ID);
    mock.method(employeeIdentity, "findOrCreateEntityForEmployee", async () => {
      identityCalls += 1;
      return { entityId: "entity-linked" };
    });
    mock.method(employeesServer, "createEmployeeForHouseWithAccess", async () => ({
      id: "emp-1",
      house_id: HOUSE_ID,
      code: "EI-001",
      entity_id: "entity-linked",
      full_name: "Allowed Create",
      status: "active",
      branch_id: BRANCH_ID,
      branch_name: "Main",
      rate_per_day: 800,
      created_at: "2026-01-01T00:00:00.000Z",
    }) as never);

    const response = await POST(
      new Request(`http://localhost/api/hr/employees?houseId=${HOUSE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: "Allowed Create",
          branch_id: BRANCH_ID,
          rate_per_day: 800,
          email: "allowed@example.com",
        }),
      }) as never,
    );

    assert.equal(response.status, 201);
    assert.equal(identityCalls, 1);
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


describe("GET /api/hr/employees tenancy boundaries", () => {
  afterEach(() => mock.restoreAll());

  it("rejects missing house membership", async () => {
    mock.method(routeGuardOrder, "resolveHrRouteActorContext", async () => ({
      supabase: {
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle() {
              return Promise.resolve({ data: null, error: null });
            },
            order() {
              return this;
            },
            limit() {
              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      } as never,
      entityId: "entity-1",
      userId: "user-1",
    } as never));
    mock.method(employeesServer, "listEmployeesByHouse", async () => ({ employees: [], error: null }));

    const response = await GET(new Request("http://localhost/api/hr/employees") as never);

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "No accessible house");
  });

  it("rejects mismatched houseId requested by the caller", async () => {
    const fromCalls: Array<{ table: string; houseId: string }> = [];

    mock.method(routeGuardOrder, "resolveHrRouteActorContext", async () => ({
      supabase: {
        from(table: string) {
          return {
            select() {
              return this;
            },
            eq(column: string, value: string) {
              if (column === "house_id") {
                fromCalls.push({ table, houseId: value });
              }
              return this;
            },
            maybeSingle() {
              return Promise.resolve({ data: null, error: null });
            },
            order() {
              return this;
            },
            limit() {
              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      } as never,
      entityId: "entity-1",
      userId: "user-1",
    }));

    const response = await GET(
      new Request("http://localhost/api/hr/employees?houseId=99999999-9999-4999-8999-999999999999") as never,
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "No accessible house");
    assert.equal(fromCalls[0]?.houseId, "99999999-9999-4999-8999-999999999999");
  });

  it("returns house-wide scoped employees when houseId is omitted", async () => {
    mock.method(routeGuardOrder, "resolveHrRouteActorContext", async () => ({
      supabase: {
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              return Promise.resolve({
                data: [{ house_id: HOUSE_ID }],
                error: null,
              });
            },
            maybeSingle() {
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      } as never,
      entityId: "entity-1",
      userId: "user-1",
    }));

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

    mock.method(employeesServer, "listEmployeesByHouse", async (_supabase: unknown, houseId: string) => ({
      employees: [
        {
          id: "emp-house-a",
          house_id: houseId,
          full_name: "Scoped Employee",
        },
      ],
      error: null,
    }) as never);

    const response = await GET(new Request("http://localhost/api/hr/employees") as never);

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload?.employees?.length, 1);
    assert.equal(payload?.employees?.[0]?.house_id, HOUSE_ID);
  });
});
