"use server";

import { revalidatePath } from "next/cache";

import { requireHrAccess } from "@/lib/hr/access";
import { createDtrSegment, DtrSegmentAccessError } from "@/lib/hr/dtr-segments-server";
import { assertManilaReasonableSegment, toManilaTimestamptz } from "@/lib/hr/timezone";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

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

function toTimestamp(workDate: string, timeValue: string) {
  return toManilaTimestamptz(workDate, `${timeValue}:00`);
}

export async function createDtrSegmentAction(formData: FormData) {
  const parsed = CreateSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    employeeId: formData.get("employeeId"),
    workDate: formData.get("workDate"),
    timeIn: formData.get("timeIn"),
    timeOut: formData.get("timeOut") || undefined,
  });

  if (!parsed.success) {
    console.warn("Invalid DTR segment payload", parsed.error.flatten());
    return;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return;
  }

  const access = await requireHrAccess(supabase, parsed.data.houseId);
  if (!access.allowed) {
    return;
  }

  try {
    const timeIn = toTimestamp(parsed.data.workDate, parsed.data.timeIn);
    const timeOut = parsed.data.timeOut ? toTimestamp(parsed.data.workDate, parsed.data.timeOut) : null;
    if (!timeIn || (parsed.data.timeOut && !timeOut)) {
      console.warn("Invalid DTR segment timestamps");
      return;
    }
    const validation = assertManilaReasonableSegment(
      timeIn,
      timeOut,
      parsed.data.workDate,
    );
    if (!validation.ok) {
      console.warn("Rejected DTR segment timestamps", validation.reasons);
      return;
    }

    await createDtrSegment(supabase, {
      houseId: parsed.data.houseId,
      employeeId: parsed.data.employeeId,
      workDate: parsed.data.workDate,
      timeIn,
      timeOut,
    });
  } catch (error) {
    if (error instanceof DtrSegmentAccessError) {
      console.warn("DTR segment create denied", error.message);
      return;
    }
    console.error("Failed to create DTR segment", error);
    return;
  }

  revalidatePath(`/company/${parsed.data.houseSlug}/hr/dtr`);
}

export async function updateDtrSegmentAction(formData: FormData) {
  const parsed = UpdateSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    segmentId: formData.get("segmentId"),
    workDate: formData.get("workDate"),
    timeIn: formData.get("timeIn"),
    timeOut: formData.get("timeOut") || undefined,
  });

  if (!parsed.success) {
    console.warn("Invalid DTR segment update", parsed.error.flatten());
    return;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return;
  }

  const access = await requireHrAccess(supabase, parsed.data.houseId);
  if (!access.allowed) {
    return;
  }

  const timeIn = toTimestamp(parsed.data.workDate, parsed.data.timeIn);
  const timeOut = parsed.data.timeOut ? toTimestamp(parsed.data.workDate, parsed.data.timeOut) : null;
  if (!timeIn || (parsed.data.timeOut && !timeOut)) {
    console.warn("Invalid DTR segment timestamps");
    return;
  }
  const validation = assertManilaReasonableSegment(
    timeIn,
    timeOut,
    parsed.data.workDate,
  );
  if (!validation.ok) {
    console.warn("Rejected DTR segment timestamps", validation.reasons);
    return;
  }

  const { data, error } = await supabase
    .from("dtr_segments")
    .update({
      time_in: timeIn,
      time_out: timeOut,
      status: timeOut ? "closed" : "open",
    })
    .eq("id", parsed.data.segmentId)
    .eq("house_id", parsed.data.houseId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Failed to update DTR segment", error?.message ?? "Missing segment");
    return;
  }

  revalidatePath(`/company/${parsed.data.houseSlug}/hr/dtr`);
}
