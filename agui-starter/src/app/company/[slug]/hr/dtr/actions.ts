"use server";

import { revalidatePath } from "next/cache";

import { requireHrAccessWithBranch } from "@/lib/hr/access";
import {
  createDtrSegment,
  DtrSegmentAccessError,
  resolveDtrEmployeeWriteTargetForHouseWithAccess,
  resolveDtrSegmentWriteTargetForHouseWithAccess,
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
  workDate: z.string().regex(DATE_REGEX, "Invalid work date"),
  timeIn: z.string().regex(TIME_REGEX, "Invalid time in"),
  timeOut: z.string().regex(TIME_REGEX, "Invalid time out").optional(),
});

const UpdateSchema = z.object({
  houseId: z.string().trim().min(1, "Missing house context"),
  houseSlug: z.string().trim().min(1, "Missing workspace context"),
  segmentId: z.string().trim().min(1, "Missing segment"),
  workDate: z.string().regex(DATE_REGEX, "Invalid work date"),
  timeIn: z.string().regex(TIME_REGEX, "Invalid time in"),
  timeOut: z.string().regex(TIME_REGEX, "Invalid time out").optional(),
});

const VALIDATION_ERROR_MESSAGE = "Fix the highlighted fields and try again.";
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
    const field = typeof issue.path?.[0] === "string" ? issue.path[0] : "form";
    if (!fieldErrors[field]) fieldErrors[field] = [];
    fieldErrors[field].push(issue.message ?? "Invalid value");
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
  });
  if (!access.allowed) {
    return FORBIDDEN_RESPONSE;
  }

  try {
    const target = await resolveDtrEmployeeWriteTargetForHouseWithAccess(
      supabase,
      access,
      parsed.data.houseId,
      parsed.data.employeeId,
    );
    if (!target) {
      return NOT_FOUND_RESPONSE;
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

    await createDtrSegment(supabase, {
      houseId: parsed.data.houseId,
      employeeId: target.id,
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

    const { data, error } = await supabase
      .from("dtr_segments")
      .update({
        time_in: timeIn,
        time_out: timeOut,
        status: timeOut ? "closed" : "open",
      })
      .eq("id", target.id)
      .eq("house_id", target.house_id)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NOT_FOUND_RESPONSE;
    }
  } catch (error) {
    if (error instanceof DtrSegmentAccessError) {
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
