import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { EmployeeAccessError } from "@/lib/hr/employees";
import * as hrAccess from "@/lib/hr/access";
import * as employeesServer from "@/lib/hr/employees-server";
import * as supabaseServer from "@/lib/supabase/server";
import { createEmployeeAction } from "../actions";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const BRANCH_ID = "44444444-4444-4444-8444-444444444444";
const ENTITY_ID = "11111111-1111-4111-8111-111111111111";

describe("createEmployeeAction boundary error mapping", () => {
  afterEach(() => mock.restoreAll());

  it("returns explicit permission-denied message for forbidden create", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(employeesServer, "createEmployeeForHouseWithAccess", async () => {
      throw new EmployeeAccessError("Not allowed");
    });

    const formData = new FormData();
    formData.set("houseId", HOUSE_ID);
    formData.set("houseSlug", "demo-house");
    formData.set("full_name", "Denied Create");
    formData.set("status", "active");
    formData.set("branch_id", BRANCH_ID);
    formData.set("rate_per_day", "1000");
    formData.set("entity_id", ENTITY_ID);

    const result = await createEmployeeAction({ status: "idle" } as never, formData);

    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to add employees for this house.");
  });

  it("returns authentication-required when session is missing", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => null as never);

    const formData = new FormData();
    formData.set("houseId", HOUSE_ID);
    formData.set("houseSlug", "demo-house");
    formData.set("full_name", "Denied Create");
    formData.set("status", "active");
    formData.set("branch_id", BRANCH_ID);
    formData.set("rate_per_day", "1000");
    formData.set("entity_id", ENTITY_ID);

    const result = await createEmployeeAction({ status: "idle" } as never, formData);

    assert.equal(result.status, "error");
    assert.equal(result.message, "Authentication required.");
  });

  it("returns validation error for bad payload", async () => {
    const formData = new FormData();
    formData.set("houseId", HOUSE_ID);
    formData.set("houseSlug", "demo-house");
    formData.set("full_name", "A");
    formData.set("status", "active");
    formData.set("rate_per_day", "-1");

    const result = await createEmployeeAction({ status: "idle" } as never, formData);

    assert.equal(result.status, "error");
    assert.ok(typeof result.message === "string" && result.message.length > 0);
  });

  it("returns generic failure for unexpected create errors", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(employeesServer, "createEmployeeForHouseWithAccess", async () => {
      throw new Error("boom");
    });

    const formData = new FormData();
    formData.set("houseId", HOUSE_ID);
    formData.set("houseSlug", "demo-house");
    formData.set("full_name", "Denied Create");
    formData.set("status", "active");
    formData.set("branch_id", BRANCH_ID);
    formData.set("rate_per_day", "1000");
    formData.set("entity_id", ENTITY_ID);

    const result = await createEmployeeAction({ status: "idle" } as never, formData);

    assert.equal(result.status, "error");
    assert.equal(result.message, "Unable to create employee right now.");
  });
});
