"use server";

import { revalidatePath } from "next/cache";

import { requireHrAccessWithBranch } from "@/lib/hr/access";
import {
  adjudicateAttendanceRemediationCase,
  finalizeAttendanceCorrection,
  finalizeAttendanceRemediationCase,
  openAttendanceRemediationCase,
  proposeAttendanceCorrection,
} from "@/lib/hr/attendance-p1-server";
import {
  createDtrSegment,
  DtrSegmentAccessError,
  resolveDtrEmployeeWriteTargetForHouseWithAccess,
} from "@/lib/hr/dtr-segments-server";
import {
  assertManilaReasonableSegment,
  toManilaDate,
  toManilaTimestamptz,
} from "@/lib/hr/timezone";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";
import type { DtrMutationState } from "./action-types";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

const CreateSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  employeeId: z.string().trim().min(1, "Missing employee"),
  actualBranchId: z.string().trim().min(1, "Select the branch where attendance occurred"),
  operationId: z.string().trim().min(1, "Missing operation identity"),
  workDate: z.string().regex(DATE_REGEX, "Invalid work date"),
  timeIn: z.string().regex(TIME_REGEX, "Invalid time in"),
  timeOut: z.string().regex(TIME_REGEX, "Invalid time out").optional(),
});

const CorrectionSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  factId: z.string().trim().min(1, "Missing attendance fact"),
  proposalOperationId: z.string().trim().min(1, "Missing proposal operation identity"),
  finalizeOperationId: z.string().trim().min(1, "Missing finalization operation identity"),
  workDate: z.string().regex(DATE_REGEX, "Invalid work date"),
  timeIn: z.string().regex(TIME_REGEX, "Invalid time in"),
  timeOut: z.string().regex(TIME_REGEX, "Invalid time out").optional(),
  targetBranchId: z.string().trim().optional(),
  reason: z.string().trim().min(3, "Enter a correction reason"),
});

const RemediationOpenSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  employeeId: z.string().trim().min(1, "Missing employee"),
  operationId: z.string().trim().min(1, "Missing operation identity"),
  workDate: z.string().regex(DATE_REGEX, "Invalid work date"),
  timeIn: z.string().regex(TIME_REGEX, "Invalid time in"),
  timeOut: z.string().regex(TIME_REGEX, "Invalid time out").optional(),
  assertedBranchId: z.string().trim().min(1, "Select the branch where attendance occurred"),
  reason: z.string().trim().min(3, "Enter a remediation reason"),
});

const RemediationAdjudicateSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  caseId: z.string().trim().min(1, "Missing remediation case"),
  operationId: z.string().trim().min(1, "Missing adjudication operation identity"),
  finalizeOperationId: z.string().trim().min(1, "Missing finalization operation identity"),
  decision: z.enum(["EXISTING_RELATED", "DISTINCT_NEW"]),
  selectedCandidateIdentity: z.string().trim().optional(),
});

const VALIDATION_ERROR_MESSAGE = "Fix the highlighted fields and try again.";
const INVALID_CONTEXT_ERROR_MESSAGE = "Request context is missing or invalid. Refresh and try again.";
const HISTORICAL_CREATE_REVIEW_MESSAGE =
  "Historical manual creation requires owner/manager review.";
const AUTH_REQUIRED_RESPONSE = {
  status: "error",
  message: "Authentication required.",
  fieldErrors: {},
} satisfies DtrMutationState;
const FORBIDDEN_RESPONSE = {
  status: "error",
  message: "You are not allowed to modify this record.",
  fieldErrors: {},
} satisfies DtrMutationState;
const NOT_FOUND_RESPONSE = {
  status: "error",
  message: "Record not found.",
  fieldErrors: {},
} satisfies DtrMutationState;
const UNEXPECTED_RESPONSE = {
  status: "error",
  message: "Unable to save changes right now.",
  fieldErrors: {},
} satisfies DtrMutationState;

const HIDDEN_CONTEXT_FIELDS = new Set([
  "houseId",
  "houseSlug",
  "employeeId",
  "factId",
  "caseId",
  "operationId",
  "proposalOperationId",
  "finalizeOperationId",
  "workDate",
]);
const HIDDEN_CONTEXT_MESSAGE_HINTS = [
  "Missing house context",
  "Missing workspace context",
  "Missing employee",
  "Missing attendance fact",
  "Missing remediation case",
  "Invalid work date",
];

function toTimestamp(workDate: string, timeValue: string) {
  return toManilaTimestamptz(workDate, `${timeValue}:00`);
}

function toValidationFieldErrors(error: { issues: Array<{ path?: unknown[]; message?: string }> }) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const issuePathField = typeof issue.path?.[0] === "string" ? issue.path[0] : "form";
    const issueMessage = issue.message ?? "Invalid value";
    const isHiddenContextField =
      HIDDEN_CONTEXT_FIELDS.has(issuePathField) ||
      (issuePathField === "form" &&
        HIDDEN_CONTEXT_MESSAGE_HINTS.some((hint) => issueMessage.includes(hint)));
    const field = isHiddenContextField ? "form" : issuePathField;
    if (!fieldErrors[field]) fieldErrors[field] = [];
    const normalizedMessage = isHiddenContextField
      ? INVALID_CONTEXT_ERROR_MESSAGE
      : issueMessage;
    if (!fieldErrors[field].includes(normalizedMessage)) {
      fieldErrors[field].push(normalizedMessage);
    }
  }
  return fieldErrors;
}

function validateManilaTimes(workDate: string, timeInValue: string, timeOutValue?: string) {
  const timeIn = toTimestamp(workDate, timeInValue);
  const timeOut = timeOutValue ? toTimestamp(workDate, timeOutValue) : null;
  if (!timeIn || (timeOutValue && !timeOut)) {
    return {
      ok: false as const,
      state: {
        status: "error",
        message: VALIDATION_ERROR_MESSAGE,
        fieldErrors: {
          timeIn: ["Invalid time in"],
          ...(timeOutValue ? { timeOut: ["Invalid time out"] } : {}),
        },
      } satisfies DtrMutationState,
    };
  }

  const validation = assertManilaReasonableSegment(timeIn, timeOut, workDate);
  if (!validation.ok) {
    return {
      ok: false as const,
      state: {
        status: "error",
        message: VALIDATION_ERROR_MESSAGE,
        fieldErrors: {
          timeIn: validation.reasons,
          ...(timeOutValue ? { timeOut: validation.reasons } : {}),
        },
      } satisfies DtrMutationState,
    };
  }

  return { ok: true as const, timeIn, timeOut };
}

export async function createDtrSegmentAction(
  _prevState: DtrMutationState,
  formData: FormData,
): Promise<DtrMutationState> {
  const parsed = CreateSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    employeeId: formData.get("employeeId"),
    actualBranchId: formData.get("actualBranchId"),
    operationId: formData.get("operationId"),
    workDate: formData.get("workDate"),
    timeIn: formData.get("timeIn"),
    timeOut: formData.get("timeOut") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: toValidationFieldErrors(parsed.error),
    };
  }

  const manilaToday = toManilaDate(new Date());
  if (!manilaToday || parsed.data.workDate !== manilaToday) {
    return {
      status: "error",
      message: HISTORICAL_CREATE_REVIEW_MESSAGE,
      fieldErrors: {},
      resultStatus: "HISTORICAL_REVIEW_REQUIRED",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return AUTH_REQUIRED_RESPONSE;

  const access = await requireHrAccessWithBranch(supabase, {
    houseId: parsed.data.houseId,
    requiredLevel: "write",
    writeScope: "branch-set-preflight",
  });
  if (!access.allowed) return FORBIDDEN_RESPONSE;

  const times = validateManilaTimes(
    parsed.data.workDate,
    parsed.data.timeIn,
    parsed.data.timeOut,
  );
  if (!times.ok) return times.state;

  try {
    const target = await resolveDtrEmployeeWriteTargetForHouseWithAccess(
      supabase,
      access,
      parsed.data.houseId,
      parsed.data.employeeId,
    );
    if (!target) return NOT_FOUND_RESPONSE;

    if (
      access.isBranchLimited &&
      !access.allowedBranchIds.includes(parsed.data.actualBranchId.toLowerCase())
    ) {
      return FORBIDDEN_RESPONSE;
    }

    await createDtrSegment(supabase, {
      houseId: parsed.data.houseId,
      employeeId: target.id,
      actualBranchId: parsed.data.actualBranchId,
      operationId: parsed.data.operationId,
      workDate: parsed.data.workDate,
      timeIn: times.timeIn,
      timeOut: times.timeOut,
    });
  } catch (error) {
    if (error instanceof DtrSegmentAccessError) return FORBIDDEN_RESPONSE;
    console.error("Failed to create DTR segment", error);
    return UNEXPECTED_RESPONSE;
  }

  revalidatePath(`/company/${parsed.data.houseSlug}/hr/dtr`);
  return { status: "success", message: "DTR segment saved.", fieldErrors: {} };
}

export async function proposeDtrCorrectionAction(
  _prevState: DtrMutationState,
  formData: FormData,
): Promise<DtrMutationState> {
  const parsed = CorrectionSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    factId: formData.get("factId"),
    proposalOperationId: formData.get("proposalOperationId"),
    finalizeOperationId: formData.get("finalizeOperationId"),
    workDate: formData.get("workDate"),
    timeIn: formData.get("timeIn"),
    timeOut: formData.get("timeOut") || undefined,
    targetBranchId: formData.get("targetBranchId") || undefined,
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: toValidationFieldErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return AUTH_REQUIRED_RESPONSE;

  const access = await requireHrAccessWithBranch(supabase, {
    houseId: parsed.data.houseId,
    requiredLevel: "write",
    writeScope: "branch-set-preflight",
  });
  if (!access.allowed) return FORBIDDEN_RESPONSE;

  const times = validateManilaTimes(
    parsed.data.workDate,
    parsed.data.timeIn,
    parsed.data.timeOut,
  );
  if (!times.ok) return times.state;

  try {
    const proposal = await proposeAttendanceCorrection(supabase, {
      houseId: parsed.data.houseId,
      factId: parsed.data.factId,
      operationId: parsed.data.proposalOperationId,
      workDate: parsed.data.workDate,
      timeIn: times.timeIn,
      timeOut: times.timeOut,
      targetBranchId: parsed.data.targetBranchId || null,
      reason: parsed.data.reason,
    });

    if (proposal.status === "TARGET_UNAVAILABLE") return FORBIDDEN_RESPONSE;
    if (proposal.status !== "PROPOSED" || !proposal.caseId) {
      return {
        status: "error",
        message: "Unable to record the correction proposal.",
        fieldErrors: {},
        resultStatus: proposal.status,
      };
    }

    const finalization = await finalizeAttendanceCorrection(supabase, {
      houseId: parsed.data.houseId,
      caseId: proposal.caseId,
      operationId: parsed.data.finalizeOperationId,
    });

    if (finalization.status === "FINALIZED") {
      revalidatePath(`/company/${parsed.data.houseSlug}/hr/dtr`);
      return {
        status: "success",
        message: "Attendance correction finalized.",
        fieldErrors: {},
        caseId: proposal.caseId,
        resultStatus: finalization.status,
      };
    }

    if (finalization.status === "APPROVAL_DEPENDENCY_UNAVAILABLE") {
      return {
        status: "success",
        message:
          "Correction proposal recorded. Payroll-impacting finalization is waiting for the approved payroll authorization dependency.",
        fieldErrors: {},
        caseId: proposal.caseId,
        resultStatus: finalization.status,
      };
    }

    if (finalization.status === "STALE") {
      return {
        status: "error",
        message: "Attendance changed before finalization. Refresh and submit a new correction.",
        fieldErrors: {},
        caseId: proposal.caseId,
        resultStatus: finalization.status,
      };
    }

    return {
      status: "error",
      message: "Correction could not be finalized.",
      fieldErrors: {},
      caseId: proposal.caseId,
      resultStatus: finalization.status,
    };
  } catch (error) {
    console.error("Failed to propose/finalize attendance correction", error);
    return UNEXPECTED_RESPONSE;
  }
}

export async function openDtrRemediationAction(
  _prevState: DtrMutationState,
  formData: FormData,
): Promise<DtrMutationState> {
  const parsed = RemediationOpenSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    employeeId: formData.get("employeeId"),
    operationId: formData.get("operationId"),
    workDate: formData.get("workDate"),
    timeIn: formData.get("timeIn"),
    timeOut: formData.get("timeOut") || undefined,
    assertedBranchId: formData.get("assertedBranchId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: toValidationFieldErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return AUTH_REQUIRED_RESPONSE;

  const access = await requireHrAccessWithBranch(supabase, {
    houseId: parsed.data.houseId,
    requiredLevel: "write",
    writeScope: "house-global",
  });
  if (!access.allowed || access.isBranchLimited) return FORBIDDEN_RESPONSE;

  const times = validateManilaTimes(
    parsed.data.workDate,
    parsed.data.timeIn,
    parsed.data.timeOut,
  );
  if (!times.ok) return times.state;

  try {
    const result = await openAttendanceRemediationCase(supabase, {
      houseId: parsed.data.houseId,
      employeeId: parsed.data.employeeId,
      operationId: parsed.data.operationId,
      workDate: parsed.data.workDate,
      timeIn: times.timeIn,
      timeOut: times.timeOut,
      assertedBranchId: parsed.data.assertedBranchId,
      reason: parsed.data.reason,
    });

    if (result.status !== "OPEN" || !result.caseId) {
      return {
        status: "error",
        message: "Unable to open historical attendance review.",
        fieldErrors: {},
        resultStatus: result.status,
      };
    }

    return {
      status: "success",
      message: result.coverageComplete
        ? "Candidate review is ready. Adjudicate whether this attendance already exists or is genuinely distinct."
        : "Candidate coverage is incomplete. Distinct-new creation is unavailable.",
      fieldErrors: {},
      caseId: result.caseId,
      resultStatus: result.status,
      coverageComplete: result.coverageComplete,
      candidates: result.candidates ?? [],
    };
  } catch (error) {
    console.error("Failed to open attendance remediation", error);
    return UNEXPECTED_RESPONSE;
  }
}

export async function adjudicateDtrRemediationAction(
  _prevState: DtrMutationState,
  formData: FormData,
): Promise<DtrMutationState> {
  const parsed = RemediationAdjudicateSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    caseId: formData.get("caseId"),
    operationId: formData.get("operationId"),
    finalizeOperationId: formData.get("finalizeOperationId"),
    decision: formData.get("decision"),
    selectedCandidateIdentity: formData.get("selectedCandidateIdentity") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: toValidationFieldErrors(parsed.error),
    };
  }

  if (
    parsed.data.decision === "EXISTING_RELATED" &&
    !parsed.data.selectedCandidateIdentity
  ) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: { selectedCandidateIdentity: ["Select the related candidate"] },
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return AUTH_REQUIRED_RESPONSE;

  const access = await requireHrAccessWithBranch(supabase, {
    houseId: parsed.data.houseId,
    requiredLevel: "write",
    writeScope: "house-global",
  });
  if (!access.allowed || access.isBranchLimited) return FORBIDDEN_RESPONSE;

  try {
    const adjudication = await adjudicateAttendanceRemediationCase(supabase, {
      houseId: parsed.data.houseId,
      caseId: parsed.data.caseId,
      operationId: parsed.data.operationId,
      decision: parsed.data.decision,
      selectedCandidateIdentity:
        parsed.data.decision === "EXISTING_RELATED"
          ? parsed.data.selectedCandidateIdentity ?? null
          : null,
    });

    if (adjudication.status === "EXISTING_RELATED") {
      return {
        status: "success",
        message:
          adjudication.route === "CORRECTION"
            ? "Related attendance already exists. Use the correction flow for that fact."
            : "Related evidence exists but is unresolved. No duplicate attendance was created.",
        fieldErrors: {},
        caseId: parsed.data.caseId,
        resultStatus: adjudication.status,
        route: adjudication.route,
      };
    }

    if (adjudication.status === "COVERAGE_INCOMPLETE") {
      return {
        status: "error",
        message: "Candidate coverage is incomplete. Distinct-new creation is unavailable.",
        fieldErrors: {},
        caseId: parsed.data.caseId,
        resultStatus: adjudication.status,
      };
    }

    if (adjudication.status !== "ADJUDICATED_DISTINCT") {
      return {
        status: "error",
        message: "Remediation adjudication could not be completed.",
        fieldErrors: {},
        caseId: parsed.data.caseId,
        resultStatus: adjudication.status,
      };
    }

    const finalization = await finalizeAttendanceRemediationCase(supabase, {
      houseId: parsed.data.houseId,
      caseId: parsed.data.caseId,
      operationId: parsed.data.finalizeOperationId,
    });

    if (finalization.status === "FINALIZED") {
      revalidatePath(`/company/${parsed.data.houseSlug}/hr/dtr`);
      return {
        status: "success",
        message: "Historical attendance remediation finalized.",
        fieldErrors: {},
        caseId: parsed.data.caseId,
        resultStatus: finalization.status,
      };
    }

    if (finalization.status === "APPROVAL_DEPENDENCY_UNAVAILABLE") {
      return {
        status: "success",
        message:
          "Distinct-new adjudication recorded. Creation is waiting for the approved payroll authorization dependency.",
        fieldErrors: {},
        caseId: parsed.data.caseId,
        resultStatus: finalization.status,
      };
    }

    if (finalization.status === "STALE") {
      return {
        status: "error",
        message: "Attendance evidence changed. Review the candidate universe again.",
        fieldErrors: {},
        caseId: parsed.data.caseId,
        resultStatus: finalization.status,
      };
    }

    return {
      status: "error",
      message: "Remediation could not be finalized.",
      fieldErrors: {},
      caseId: parsed.data.caseId,
      resultStatus: finalization.status,
    };
  } catch (error) {
    console.error("Failed to adjudicate/finalize attendance remediation", error);
    return UNEXPECTED_RESPONSE;
  }
}
