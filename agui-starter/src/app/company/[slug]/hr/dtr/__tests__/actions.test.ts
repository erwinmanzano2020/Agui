import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as hrAccess from "@/lib/hr/access";
import * as attendanceP1 from "@/lib/hr/attendance-p1-server";
import { DtrSegmentAccessError } from "@/lib/hr/dtr-segments-server";
import * as dtrSegmentsServer from "@/lib/hr/dtr-segments-server";
import { toManilaDate } from "@/lib/hr/timezone";
import * as supabaseServer from "@/lib/supabase/server";
import { dtrMutationInitialState } from "../action-types";
import {
  adjudicateDtrRemediationAction,
  createDtrSegmentAction,
  openDtrRemediationAction,
  proposeDtrCorrectionAction,
} from "../actions";
import { FieldError, MutationMessage } from "../DtrSegmentForms";

const HOUSE_ID = "house-1";
const HOUSE_SLUG = "demo-house";
const TODAY = toManilaDate(new Date()) ?? "2026-09-25";

function buildCorrectionFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.set("houseId", overrides.houseId ?? HOUSE_ID);
  formData.set("houseSlug", overrides.houseSlug ?? HOUSE_SLUG);
  formData.set("factId", overrides.factId ?? "fact-1");
  formData.set("proposalOperationId", overrides.proposalOperationId ?? "proposal-1");
  formData.set("finalizeOperationId", overrides.finalizeOperationId ?? "finalize-1");
  formData.set("workDate", overrides.workDate ?? TODAY);
  formData.set("timeIn", overrides.timeIn ?? "08:00");
  if (overrides.timeOut !== undefined) formData.set("timeOut", overrides.timeOut);
  if (overrides.targetBranchId !== undefined) formData.set("targetBranchId", overrides.targetBranchId);
  formData.set("reason", overrides.reason ?? "Correct attendance time");
  return formData;
}

function buildCreateFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.set("houseId", overrides.houseId ?? HOUSE_ID);
  formData.set("houseSlug", overrides.houseSlug ?? HOUSE_SLUG);
  formData.set("employeeId", overrides.employeeId ?? "emp-1");
  formData.set("actualBranchId", overrides.actualBranchId ?? "branch-1");
  formData.set("operationId", overrides.operationId ?? "op-create-1");
  formData.set("workDate", overrides.workDate ?? TODAY);
  formData.set("timeIn", overrides.timeIn ?? "08:00");
  if (overrides.timeOut !== undefined) formData.set("timeOut", overrides.timeOut);
  return formData;
}

function buildRemediationOpenFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.set("houseId", overrides.houseId ?? HOUSE_ID);
  formData.set("houseSlug", overrides.houseSlug ?? HOUSE_SLUG);
  formData.set("employeeId", overrides.employeeId ?? "emp-1");
  formData.set("operationId", overrides.operationId ?? "rem-open-1");
  formData.set("workDate", overrides.workDate ?? "2026-09-24");
  formData.set("timeIn", overrides.timeIn ?? "08:00");
  formData.set("timeOut", overrides.timeOut ?? "17:00");
  formData.set("assertedBranchId", overrides.assertedBranchId ?? "branch-1");
  formData.set("reason", overrides.reason ?? "Missing historical attendance");
  return formData;
}

function buildAdjudicationFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.set("houseId", overrides.houseId ?? HOUSE_ID);
  formData.set("houseSlug", overrides.houseSlug ?? HOUSE_SLUG);
  formData.set("caseId", overrides.caseId ?? "case-1");
  formData.set("operationId", overrides.operationId ?? "adj-1");
  formData.set("finalizeOperationId", overrides.finalizeOperationId ?? "rem-finalize-1");
  formData.set("decision", overrides.decision ?? "DISTINCT_NEW");
  if (overrides.selectedCandidateIdentity !== undefined) {
    formData.set("selectedCandidateIdentity", overrides.selectedCandidateIdentity);
  }
  return formData;
}

function allowWrite(overrides: Record<string, unknown> = {}) {
  return {
    allowed: true,
    hasWorkspaceAccess: true,
    isBranchLimited: false,
    allowedBranchIds: ["branch-1"],
    ...overrides,
  } as never;
}

describe("Historical Daily DTR P1 action boundary", () => {
  afterEach(() => mock.restoreAll());

  it("maps correction validation errors without leaking hidden context", async () => {
    const hiddenContextResult = await proposeDtrCorrectionAction(
      dtrMutationInitialState,
      buildCorrectionFormData({ houseId: "" }),
    );
    assert.equal(hiddenContextResult.status, "error");
    assert.equal(
      hiddenContextResult.fieldErrors.form?.[0],
      "Request context is missing or invalid. Refresh and try again.",
    );
    assert.doesNotMatch(
      JSON.stringify(hiddenContextResult.fieldErrors),
      /Missing house context/i,
    );

    const fieldResult = await proposeDtrCorrectionAction(
      dtrMutationInitialState,
      buildCorrectionFormData({ timeIn: "bad" }),
    );
    assert.equal(fieldResult.status, "error");
    assert.ok(fieldResult.fieldErrors.timeIn?.length);
  });

  it("returns authentication required before correction RPCs", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => null as never);
    const result = await proposeDtrCorrectionAction(
      dtrMutationInitialState,
      buildCorrectionFormData(),
    );
    assert.equal(result.message, "Authentication required.");
  });

  it("maps exact-fact TARGET_UNAVAILABLE to the generic forbidden response", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite());
    mock.method(attendanceP1, "proposeAttendanceCorrection", async () => ({
      status: "TARGET_UNAVAILABLE",
    }));

    const result = await proposeDtrCorrectionAction(
      dtrMutationInitialState,
      buildCorrectionFormData(),
    );
    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to modify this record.");
  });

  it("records payroll-impacting proposal while HR-4 finalization is unavailable", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite());
    mock.method(attendanceP1, "proposeAttendanceCorrection", async () => ({
      status: "PROPOSED",
      caseId: "case-1",
      payrollImpact: "PAYROLL_IMPACTING",
    }));
    mock.method(attendanceP1, "finalizeAttendanceCorrection", async () => ({
      status: "APPROVAL_DEPENDENCY_UNAVAILABLE",
    }));

    const result = await proposeDtrCorrectionAction(
      dtrMutationInitialState,
      buildCorrectionFormData(),
    );
    assert.equal(result.status, "success");
    assert.equal(result.caseId, "case-1");
    assert.equal(result.resultStatus, "APPROVAL_DEPENDENCY_UNAVAILABLE");
    assert.match(result.message, /proposal recorded/i);
  });

  it("surfaces stale correction without false success", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite());
    mock.method(attendanceP1, "proposeAttendanceCorrection", async () => ({
      status: "PROPOSED",
      caseId: "case-1",
    }));
    mock.method(attendanceP1, "finalizeAttendanceCorrection", async () => ({
      status: "STALE",
    }));

    const result = await proposeDtrCorrectionAction(
      dtrMutationInitialState,
      buildCorrectionFormData(),
    );
    assert.equal(result.status, "error");
    assert.equal(result.resultStatus, "STALE");
    assert.match(result.message, /refresh/i);
  });

  it("blocks historical ordinary manual create before any mutation", async () => {
    let created = false;
    mock.method(dtrSegmentsServer, "createDtrSegment", async () => {
      created = true;
      throw new Error("should not run");
    });
    const result = await createDtrSegmentAction(
      dtrMutationInitialState,
      buildCreateFormData({ workDate: "2000-01-01" }),
    );
    assert.equal(result.status, "error");
    assert.equal(result.resultStatus, "HISTORICAL_REVIEW_REQUIRED");
    assert.equal(created, false);
  });

  it("keeps same-day ordinary manual capture available", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite());
    mock.method(dtrSegmentsServer, "resolveDtrEmployeeWriteTargetForHouseWithAccess", async () => ({
      id: "emp-1",
      house_id: HOUSE_ID,
      branch_id: "branch-1",
    }));
    mock.method(dtrSegmentsServer, "createDtrSegment", async () => ({
      id: "seg-1",
      house_id: HOUSE_ID,
      employee_id: "emp-1",
      work_date: TODAY,
      time_in: `${TODAY}T08:00:00+08:00`,
      time_out: null,
      hours_worked: null,
      overtime_minutes: 0,
      source: "manual",
      status: "open",
      canonical_fact_id: "fact-1",
      created_at: new Date().toISOString(),
    }));

    const result = await createDtrSegmentAction(
      dtrMutationInitialState,
      buildCreateFormData(),
    );
    assert.equal(result.status, "success");
  });

  it("keeps branch access denial generic for same-day create", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite({
      isBranchLimited: true,
      allowedBranchIds: ["branch-2"],
    }));
    mock.method(dtrSegmentsServer, "resolveDtrEmployeeWriteTargetForHouseWithAccess", async () => {
      throw new DtrSegmentAccessError("outside scope");
    });

    const result = await createDtrSegmentAction(
      dtrMutationInitialState,
      buildCreateFormData(),
    );
    assert.equal(result.message, "You are not allowed to modify this record.");
  });

  it("denies remediation UI action to branch-limited writers", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite({
      isBranchLimited: true,
    }));

    const result = await openDtrRemediationAction(
      dtrMutationInitialState,
      buildRemediationOpenFormData(),
    );
    assert.equal(result.status, "error");
    assert.equal(result.message, "You are not allowed to modify this record.");
  });

  it("returns resolver candidates for owner/manager remediation review", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite());
    mock.method(attendanceP1, "openAttendanceRemediationCase", async () => ({
      status: "OPEN",
      caseId: "rem-1",
      coverageComplete: true,
      candidates: [{ identity: "FACT:fact-1", kind: "FACT", factId: "fact-1" }],
    }));

    const result = await openDtrRemediationAction(
      dtrMutationInitialState,
      buildRemediationOpenFormData(),
    );
    assert.equal(result.status, "success");
    assert.equal(result.caseId, "rem-1");
    assert.equal(result.candidates?.[0]?.identity, "FACT:fact-1");
  });

  it("records distinct-new adjudication but fails closed when HR-4 is unavailable", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => allowWrite());
    mock.method(attendanceP1, "adjudicateAttendanceRemediationCase", async () => ({
      status: "ADJUDICATED_DISTINCT",
      caseId: "rem-1",
    }));
    mock.method(attendanceP1, "finalizeAttendanceRemediationCase", async () => ({
      status: "APPROVAL_DEPENDENCY_UNAVAILABLE",
    }));

    const result = await adjudicateDtrRemediationAction(
      dtrMutationInitialState,
      buildAdjudicationFormData(),
    );
    assert.equal(result.status, "success");
    assert.equal(result.resultStatus, "APPROVAL_DEPENDENCY_UNAVAILABLE");
    assert.match(result.message, /waiting/i);
  });

  it("requires a resolver-returned candidate for EXISTING_RELATED", async () => {
    const result = await adjudicateDtrRemediationAction(
      dtrMutationInitialState,
      buildAdjudicationFormData({
        decision: "EXISTING_RELATED",
        selectedCandidateIdentity: undefined,
      }),
    );
    assert.equal(result.status, "error");
    assert.ok(result.fieldErrors.selectedCandidateIdentity?.length);
  });

  it("runtime-facing UI surfaces mutation states from action responses", () => {
    const states: Array<{
      status: "success" | "error";
      message: string;
      fieldErrors: Record<string, string[]>;
      expected: RegExp;
    }> = [
      { status: "success" as const, message: "Attendance correction finalized.", fieldErrors: {}, expected: /finalized/ },
      {
        status: "error" as const,
        message: "Fix the highlighted fields and try again.",
        fieldErrors: { timeIn: ["Invalid time in"] },
        expected: /Invalid time in/,
      },
      {
        status: "error" as const,
        message: "You are not allowed to modify this record.",
        fieldErrors: {},
        expected: /not allowed/,
      },
    ];

    for (const state of states) {
      const messageHtml = renderToStaticMarkup(
        React.createElement(MutationMessage, {
          status: state.status,
          message: state.message,
          formError: state.fieldErrors.form,
        }),
      );
      if (state.fieldErrors.timeIn) {
        const fieldHtml = renderToStaticMarkup(
          React.createElement(FieldError, { message: state.fieldErrors.timeIn }),
        );
        assert.match(fieldHtml, state.expected);
      } else {
        assert.match(messageHtml, state.expected);
      }
    }
  });
});
