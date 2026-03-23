import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as hrAccess from "@/lib/hr/access";
import { EmployeeAccessError } from "@/lib/hr/employees";
import * as employeesServer from "@/lib/hr/employees-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { POST } from "../route";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";

function createServiceStub() {
  return {
    from: (table: string) => {
      if (table !== "employees") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  full_name: "Test Employee",
                  status: "active",
                  branch_id: "44444444-4444-4444-8444-444444444444",
                  rate_per_day: 500,
                  position_title: "Staff",
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  } as never;
}

describe("POST /api/hr/employees/[employeeId]/photo deny mapping", () => {
  afterEach(() => mock.restoreAll());

  it("returns 403 for authenticated forbidden photo write", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
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
      allowedBranchIds: ["44444444-4444-4444-8444-444444444444"],
    }) as never);
    mock.method(supabaseService, "getServiceSupabase", () => createServiceStub());
    mock.method(employeesServer, "updateEmployeeForHouseWithAccess", async () => {
      throw new EmployeeAccessError("Not allowed");
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/photo`, {
        method: "POST",
        body: JSON.stringify({ houseId: HOUSE_ID, photo_url: "https://img.example/photo.jpg", photo_path: "employee-photos/test.jpg" }),
      }) as never,
      { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
  });
});
