import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as hrAccess from "@/lib/hr/access";
import { DtrSegmentAccessError } from "@/lib/hr/dtr-segments-server";
import * as dtrSegmentsServer from "@/lib/hr/dtr-segments-server";
import * as supabaseServer from "@/lib/supabase/server";
import { dtrMutationInitialState } from "../action-types";
import { createDtrSegmentAction, updateDtrSegmentAction } from "../actions";

const HOUSE_ID = "house-1";
const HOUSE_SLUG = "demo-house";

function buildUpdateFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.set("houseId", overrides.houseId ?? HOUSE_ID);
  formData.set("houseSlug", overrides.houseSlug ?? HOUSE_SLUG);
  formData.set("segmentId", overrides.segmentId ?? "seg-1");
  formData.set("workDate", overrides.workDate ?? "2024-10-01");
  formData.set("timeIn", overrides.timeIn ?? "08:00");
  if (overrides.timeOut !== undefined) {
    formData.set("timeOut", overrides.timeOut);
  }
  return formData;
}

function buildCreateFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.set("houseId", overrides.houseId ?? HOUSE_ID);
  formData.set("houseSlug", overrides.houseSlug ?? HOUSE_SLUG);
  formData.set("employeeId", overrides.employeeId ?? "emp-1");
  formData.set("workDate", overrides.workDate ?? "2024-10-01");
  formData.set("timeIn", overrides.timeIn ?? "08:00");
  if (overrides.timeOut !== undefined) {
    formData.set("timeOut", overrides.timeOut);
  }
  return formData;
}

function buildSupabaseUpdateMock(result: { data: { id: string } | null; error: { message: string } | null }) {
  return {
    from(table: string) {
      assert.equal(table, "dtr_segments");
      return {
        update() {
          return this;
        },
        eq() {
          return this;
        },
        select() {
          return this;
        },
        maybeSingle: async () => result,
      };
    },
  };
}

describe("DTR action boundary mapping", () => {
  afterEach(() => mock.restoreAll());

  it("updateDtrSegmentAction returns validation field errors", async () => {
    const result = await updateDtrSegmentAction(dtrMutationInitialState, buildUpdateFormData({ timeIn: "bad-time" }));
    assert.equal(result.status, "error");
    assert.equal(result.message, "Fix the highlighted fields and try again.");
    if (!("fieldErrors" in result)) {
      throw new Error("Expected validation response to include fieldErrors");
    }
    assert.ok(Object.keys(result.fieldErrors ?? {}).length > 0);
  });

  it("updateDtrSegmentAction returns authentication required when session is missing", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => null as never);
    const result = await updateDtrSegmentAction(dtrMutationInitialState, buildUpdateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "Authentication required.");
  });

  it("updateDtrSegmentAction returns forbidden for access denied", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: false } as never));
    const result = await updateDtrSegmentAction(dtrMutationInitialState, buildUpdateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to modify this record.");
  });

  it("updateDtrSegmentAction returns not found when target resolver returns null", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(dtrSegmentsServer, "resolveDtrSegmentWriteTargetForHouseWithAccess", async () => null);
    const result = await updateDtrSegmentAction(dtrMutationInitialState, buildUpdateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "Record not found.");
  });

  it("updateDtrSegmentAction returns unexpected error on unknown failure", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      buildSupabaseUpdateMock({ data: null, error: { message: "boom" } }) as never,
    );
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(dtrSegmentsServer, "resolveDtrSegmentWriteTargetForHouseWithAccess", async () => ({
      id: "seg-1",
      house_id: HOUSE_ID,
      employee_id: "emp-1",
      employee_branch_id: "branch-1",
    }));
    const result = await updateDtrSegmentAction(dtrMutationInitialState, buildUpdateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "Unable to save changes right now.");
  });

  it("updateDtrSegmentAction returns success for valid update path", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      buildSupabaseUpdateMock({ data: { id: "seg-1" }, error: null }) as never,
    );
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(dtrSegmentsServer, "resolveDtrSegmentWriteTargetForHouseWithAccess", async () => ({
      id: "seg-1",
      house_id: HOUSE_ID,
      employee_id: "emp-1",
      employee_branch_id: "branch-1",
    }));
    const result = await updateDtrSegmentAction(dtrMutationInitialState, buildUpdateFormData());

    assert.equal(result.status, "success");
    assert.equal(result.message, "DTR segment saved.");
  });

  it("createDtrSegmentAction returns validation field errors", async () => {
    const result = await createDtrSegmentAction(dtrMutationInitialState, buildCreateFormData({ timeIn: "bad-time" }));
    assert.equal(result.status, "error");
    assert.equal(result.message, "Fix the highlighted fields and try again.");
    assert.ok(Object.keys(result.fieldErrors ?? {}).length > 0);
  });

  it("createDtrSegmentAction returns authentication required when session is missing", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => null as never);
    const result = await createDtrSegmentAction(dtrMutationInitialState, buildCreateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "Authentication required.");
  });

  it("createDtrSegmentAction returns forbidden for access denied", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: false } as never));
    const result = await createDtrSegmentAction(dtrMutationInitialState, buildCreateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to modify this record.");
  });

  it("createDtrSegmentAction returns not found when employee target is missing", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(dtrSegmentsServer, "resolveDtrEmployeeWriteTargetForHouseWithAccess", async () => null);

    const result = await createDtrSegmentAction(dtrMutationInitialState, buildCreateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "Record not found.");
  });

  it("createDtrSegmentAction returns forbidden for branch-limited out-of-scope target", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(dtrSegmentsServer, "resolveDtrEmployeeWriteTargetForHouseWithAccess", async () => {
      throw new DtrSegmentAccessError("Not allowed to update this segment");
    });

    const result = await createDtrSegmentAction(dtrMutationInitialState, buildCreateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to modify this record.");
  });

  it("createDtrSegmentAction returns unexpected error on unknown failure", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(dtrSegmentsServer, "resolveDtrEmployeeWriteTargetForHouseWithAccess", async () => ({
      id: "emp-1",
      house_id: HOUSE_ID,
      branch_id: "branch-1",
    }));
    mock.method(dtrSegmentsServer, "createDtrSegment", async () => {
      throw new Error("boom");
    });

    const result = await createDtrSegmentAction(dtrMutationInitialState, buildCreateFormData());
    assert.equal(result.status, "error");
    assert.equal(result.message, "Unable to save changes right now.");
  });

  it("createDtrSegmentAction returns success for valid create path", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({ allowed: true, hasWorkspaceAccess: true } as never));
    mock.method(dtrSegmentsServer, "resolveDtrEmployeeWriteTargetForHouseWithAccess", async () => ({
      id: "emp-1",
      house_id: HOUSE_ID,
      branch_id: "branch-1",
    }));
    mock.method(dtrSegmentsServer, "createDtrSegment", async () => ({
      id: "seg-1",
      house_id: HOUSE_ID,
      employee_id: "emp-1",
      work_date: "2024-10-01",
      time_in: "2024-10-01T08:00:00+08:00",
      time_out: null,
      hours_worked: null,
      overtime_minutes: 0,
      source: "manual",
      status: "open",
      created_at: "2024-10-01T00:00:00Z",
    }));

    const result = await createDtrSegmentAction(dtrMutationInitialState, buildCreateFormData());
    assert.equal(result.status, "success");
    assert.equal(result.message, "DTR segment saved.");
  });
});
