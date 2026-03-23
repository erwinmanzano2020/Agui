import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { EmployeeAccessError } from "@/lib/hr/employees";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { deleteEmployeeAction, updateEmployeeAction } from "../actions";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "44444444-4444-4444-8444-444444444444";

describe("employee [id] server action deny mapping", () => {
  afterEach(() => mock.restoreAll());

  it("updateEmployeeAction returns explicit permission-denied message", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(employeesServer, "updateEmployeeForHouseWithAccess", async () => {
      throw new EmployeeAccessError("Not allowed");
    });

    const formData = new FormData();
    formData.set("houseId", HOUSE_ID);
    formData.set("houseSlug", "demo-house");
    formData.set("employeeId", EMPLOYEE_ID);
    formData.set("full_name", "Denied Update");
    formData.set("status", "active");
    formData.set("branch_id", BRANCH_ID);
    formData.set("rate_per_day", "900");

    const result = await updateEmployeeAction({ status: "idle" } as never, formData);

    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to edit this employee.");
  });

  it("deleteEmployeeAction returns explicit permission-denied message", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(employeesServer, "deleteEmployeeForHouseWithAccess", async () => {
      throw new EmployeeAccessError("Not allowed");
    });

    const formData = new FormData();
    formData.set("houseId", HOUSE_ID);
    formData.set("houseSlug", "demo-house");
    formData.set("employeeId", EMPLOYEE_ID);

    const result = await deleteEmployeeAction(formData);

    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to delete this employee.");
  });
});
