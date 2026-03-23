import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as featureGuard from "@/lib/auth/feature-guard";
import * as identityServer from "@/lib/identity/entity-server";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { EmployeeAccessError } from "@/lib/hr/employees";
import { POST } from "../route";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const BRANCH_ID = "11111111-1111-4111-8111-111111111111";

function createSupabaseStub() {
  return {
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
  } as never;
}

describe("POST /api/hr/employees deny mapping", () => {
  afterEach(() => mock.restoreAll());

  it("returns 401 when unauthenticated", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
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

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload?.error, "Not authenticated");
  });

  it("returns 400 for invalid create payload", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub());
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

  it("returns 403 for authenticated forbidden create", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub());
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
    mock.method(supabaseServer, "createServerSupabaseClient", async () => createSupabaseStub());
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
});
