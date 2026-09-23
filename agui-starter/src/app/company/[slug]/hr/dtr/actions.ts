"use server";

import { revalidatePath } from "next/cache";

import { requireHrAccessWithBranch } from "@/lib/hr/access";
import {
  createDtrSegment,
  DtrSegmentAccessError,
  resolveDtrEmployeeWriteTargetForHouseWithAccess,
  resolveDtrSegmentWriteTargetForHouseWithAccess,
  updateDtrSegmentCanonical,
} from "@/lib/hr/dtr-segments-server";
import { assertManilaReasonableSegment, toManilaTimestamptz } from "@/lib/hr/timezone";
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

const UpdateSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  segmentId: z.string().trim().min(1, "Missing segment"),
  operationId: z.string().trim().min(1, "Missing operation identity"),
  expectedValueRevision: z.string().regex(/^\d+$/, "Invalid revision token").optional(),
  workDate: z.string().regex(DATE_REGEX, "Invalid work date"),
  timeIn: z.string().regex(TIME_REGEX, "Invalid time in"),
  timeOut: z.string().regex(TIME_REGEX, "Invalid time out").optional(),
});

const VALIDATION_ERROR_MESSAGE = "Fix the highlighted fields and try again.";
const HIDDEN_CONTEXT_FIELDS = new Set([
  "houseId",
  "houseSlug",
  "employeeId",
  "segmentId",
  "operationId",
  "expectedValueRevision",
  "workDate",
]);
const HIDDEN_CONTEXT_MESSAGE_HINTS = [
  "Missing house context",
  "Missing workspace context",
  "Missing employee",
  "Missing segment",
  "Invalid work date",
];
const INVALID_CONTEXT_ERROR_MESSAGE = "Request context is missing or invalid. Refresh and try again.";
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
const NOT_FOUND_RESPONSE = { status: "error", message: "Record not found.", fieldErrors: {} } satisfies DtrMutationState;
const UNEXPECTED_RESPONSE = {
  status: "error",
  message: "Unable to save changes right now.",
  fieldErrors: {},
} satisfies DtrMutationState;

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
      (issuePathField === "form" && HIDDEN_CONTEXT_MESSAGE_HINTS.some((hint) => issueMessage.includes(hint)));
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
    } satisfies DtrMutationState;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return AUTH_REQUIRED_RESPONSE;
  }

  const access = await requireHrAccessWithBranch(supabase, {
    houseId: parsed.data.houseId,
    requiredLevel: "write",
    writeScope: "branch-set-preflight",
  });
  if (!access.allowed) {
    return FORBIDDEN_RESPONSE;
  }

  try {
    const timeIn = toTimestamp(parsed.data.workDate, parsed.data.timeIn);
    const timeOut = parsed.data.timeOut ? toTimestamp(parsed.data.workDate, parsed.data.timeOut) : null;
    if (!timeIn || (parsed.data.timeOut && !timeOut)) {
      return {
        status: "error",
        message: VALIDATION_ERROR_MESSAGE,
        fieldErrors: {
          timeIn: ["Invalid time in"],
          ...(parsed.data.timeOut ? { timeOut: ["Invalid time out"] } : {}),
        },
      } satisfies DtrMutationState;
    }
    const validation = assertManilaReasonableSegment(
      timeIn,
      timeOut,
      parsed.data.workDate,
    );
    if (!validation.ok) {
      return {
        status: "error",
        message: VALIDATION_ERROR_MESSAGE,
        fieldErrors: {
          timeIn: validation.reasons,
          ...(parsed.data.timeOut ? { timeOut: validation.reasons } : {}),
        },
      } satisfies DtrMutationState;
    }

    const target = await resolveDtrEmployeeWriteTargetForHouseWithAccess(
      supabase,
      access,
      parsed.data.houseId,
      parsed.data.employeeId,
    );
    if (!target) {
      return NOT_FOUND_RESPONSE;
    }

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
      timeIn,
      timeOut,
    });
  } catch (error) {
    if (error instanceof DtrSegmentAccessError) {
      return FORBIDDEN_RESPONSE;
    }
    console.error("Failed to create DTR segment", error);
    return UNEXPECTED_RESPONSE;
  }

  if (typeof revalidatePath === "function") {
    revalidatePath(`/company/${parsed.data.houseSlug}/hr/dtr`);
  }
  return { status: "success", message: "DTR segment saved.", fieldErrors: {} } satisfies DtrMutationState;
}

export async function updateDtrSegmentAction(
  _prevState: DtrMutationState,
  formData: FormData,
): Promise<DtrMutationState> {
  const parsed = UpdateSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    segmentId: formData.get("segmentId"),
    operationId: formData.get("operationId"),
    expectedValueRevision: formData.get("expectedValueRevision") || undefined,
    workDate: formData.get("workDate"),
    timeIn: formData.get("timeIn"),
    timeOut: formData.get("timeOut") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: toValidationFieldErrors(parsed.error),
    } satisfies DtrMutationState;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return AUTH_REQUIRED_RESPONSE;
  }

  const access = await requireHrAccessWithBranch(supabase, {
    houseId: parsed.data.houseId,
    requiredLevel: "write",
    writeScope: "branch-set-preflight",
  });
  if (!access.allowed) {
    return FORBIDDEN_RESPONSE;
  }

  const timeIn = toTimestamp(parsed.data.workDate, parsed.data.timeIn);
  const timeOut = parsed.data.timeOut ? toTimestamp(parsed.data.workDate, parsed.data.timeOut) : null;
  if (!timeIn || (parsed.data.timeOut && !timeOut)) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: {
        timeIn: ["Invalid time in"],
        ...(parsed.data.timeOut ? { timeOut: ["Invalid time out"] } : {}),
      },
    } satisfies DtrMutationState;
  }
  const validation = assertManilaReasonableSegment(
    timeIn,
    timeOut,
    parsed.data.workDate,
  );
  if (!validation.ok) {
    return {
      status: "error",
      message: VALIDATION_ERROR_MESSAGE,
      fieldErrors: {
        timeIn: validation.reasons,
        ...(parsed.data.timeOut ? { timeOut: validation.reasons } : {}),
      },
    } satisfies DtrMutationState;
  }

  try {
    const target = await resolveDtrSegmentWriteTargetForHouseWithAccess(
      supabase,
      access,
      parsed.data.houseId,
      parsed.data.segmentId,
    );

    if (!target) {
      return NOT_FOUND_RESPONSE;
    }

    await updateDtrSegmentCanonical(supabase, {
      houseId: target.house_id,
      segmentId: target.id,
      operationId: parsed.data.operationId,
      timeIn,
      timeOut,
      expectedValueRevision: parsed.data.expectedValueRevision
        ? Number(parsed.data.expectedValueRevision)
        : null,
    });
  } catch (error) {
    if (error instanceof DtrSegmentAccessError) {
      if (/changed|refresh/i.test(error.message)) {
        return {
          status: "error",
          message: error.message,
          fieldErrors: {},
        } satisfies DtrMutationState;
      }
      return FORBIDDEN_RESPONSE;
    }
    console.error("Failed to update DTR segment", error);
    return UNEXPECTED_RESPONSE;
  }

  if (typeof revalidatePath === "function") {
    revalidatePath(`/company/${parsed.data.houseSlug}/hr/dtr`);
  }
  return { status: "success", message: "DTR segment saved.", fieldErrors: {} } satisfies DtrMutationState;
}
