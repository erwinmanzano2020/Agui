"use server";

import { revalidatePath } from "next/cache";

import { requireHrAccess } from "@/lib/hr/access";
import { OvertimePolicyError, upsertOvertimePolicy } from "@/lib/hr/overtime-policy-server";
import { createBranchScheduleAssignment, ScheduleAssignmentError } from "@/lib/hr/schedules-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const TIME_REGEX = /^\d{2}:\d{2}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const CreateTemplateSchema = z.object({
  houseId: z.string().trim().min(1),
  houseSlug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(TIME_REGEX),
  endTime: z.string().regex(TIME_REGEX),
  breakStart: z.string().regex(TIME_REGEX).optional().or(z.literal("")),
  breakEnd: z.string().regex(TIME_REGEX).optional().or(z.literal("")),
});

const AddWindowSchema = z.object({
  houseId: z.string().trim().min(1),
  houseSlug: z.string().trim().min(1),
  scheduleId: z.string().trim().min(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(TIME_REGEX),
  endTime: z.string().regex(TIME_REGEX),
  breakStart: z.string().regex(TIME_REGEX).optional().or(z.literal("")),
  breakEnd: z.string().regex(TIME_REGEX).optional().or(z.literal("")),
});

const AssignSchema = z.object({
  houseId: z.string().trim().min(1),
  houseSlug: z.string().trim().min(1),
  branchId: z.string().trim().min(1),
  scheduleId: z.string().trim().min(1),
  effectiveFrom: z.string().regex(DATE_REGEX),
});

const OvertimePolicySchema = z.object({
  houseId: z.string().trim().min(1),
  houseSlug: z.string().trim().min(1),
  minOtMinutes: z.coerce.number().min(0).max(240),
  roundingMode: z.enum(["NONE", "FLOOR", "CEIL", "NEAREST"]),
  roundingMinutes: z.coerce.number().superRefine((value, ctx) => {
    if (![1, 5, 10, 15].includes(value)) {
      ctx.addIssue({ message: "Invalid rounding increment" });
    }
  }),
  timezone: z.string().trim().min(1),
});

function normalizeOptionalTime(value: string | undefined) {
  if (!value || value.trim().length === 0) return null;
  return value.trim();
}

export async function createScheduleTemplateAction(formData: FormData) {
  const parsed = CreateTemplateSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    name: formData.get("name"),
    timezone: formData.get("timezone") ?? "Asia/Manila",
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    breakStart: formData.get("breakStart") ?? undefined,
    breakEnd: formData.get("breakEnd") ?? undefined,
  });

  if (!parsed.success) {
    console.warn("Invalid schedule template payload", parsed.error.flatten());
    return;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return;

  const access = await requireHrAccess(supabase, parsed.data.houseId);
  if (!access.allowed) return;

  const { data: template, error: templateError } = await supabase
    .from("hr_schedule_templates")
    .insert({
      house_id: parsed.data.houseId,
      name: parsed.data.name,
      timezone: parsed.data.timezone,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (templateError || !template) {
    console.error("Failed to create schedule template", templateError?.message ?? "missing template");
    return;
  }

  const { error: windowError } = await supabase.from("hr_schedule_windows").insert({
    house_id: parsed.data.houseId,
    schedule_id: template.id,
    day_of_week: parsed.data.dayOfWeek,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    break_start: normalizeOptionalTime(parsed.data.breakStart),
    break_end: normalizeOptionalTime(parsed.data.breakEnd),
  });

  if (windowError) {
    console.error("Failed to create schedule window", windowError.message);
    return;
  }

  revalidatePath(`/company/${parsed.data.houseSlug}/hr/schedules`);
}

export async function addScheduleWindowAction(formData: FormData) {
  const parsed = AddWindowSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    scheduleId: formData.get("scheduleId"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    breakStart: formData.get("breakStart") ?? undefined,
    breakEnd: formData.get("breakEnd") ?? undefined,
  });

  if (!parsed.success) {
    console.warn("Invalid schedule window payload", parsed.error.flatten());
    return;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return;

  const access = await requireHrAccess(supabase, parsed.data.houseId);
  if (!access.allowed) return;

  const { error } = await supabase.from("hr_schedule_windows").insert({
    house_id: parsed.data.houseId,
    schedule_id: parsed.data.scheduleId,
    day_of_week: parsed.data.dayOfWeek,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    break_start: normalizeOptionalTime(parsed.data.breakStart),
    break_end: normalizeOptionalTime(parsed.data.breakEnd),
  });

  if (error) {
    console.error("Failed to add schedule window", error.message);
    return;
  }

  revalidatePath(`/company/${parsed.data.houseSlug}/hr/schedules`);
}

export async function createBranchScheduleAssignmentAction(formData: FormData) {
  const parsed = AssignSchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    branchId: formData.get("branchId"),
    scheduleId: formData.get("scheduleId"),
    effectiveFrom: formData.get("effectiveFrom"),
  });

  if (!parsed.success) {
    console.warn("Invalid branch schedule assignment payload", parsed.error.flatten());
    return;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return;

  try {
    await createBranchScheduleAssignment(supabase, {
      houseId: parsed.data.houseId,
      branchId: parsed.data.branchId,
      scheduleId: parsed.data.scheduleId,
      effectiveFrom: parsed.data.effectiveFrom,
    });
  } catch (error) {
    if (error instanceof ScheduleAssignmentError) {
      console.warn("Schedule assignment denied", error.message);
      return;
    }
    console.error("Failed to create branch schedule assignment", error);
    return;
  }

  revalidatePath(`/company/${parsed.data.houseSlug}/hr/schedules`);
}

export async function updateOvertimePolicyAction(formData: FormData) {
  const parsed = OvertimePolicySchema.safeParse({
    houseId: formData.get("houseId"),
    houseSlug: formData.get("houseSlug"),
    minOtMinutes: formData.get("minOtMinutes"),
    roundingMode: formData.get("roundingMode"),
    roundingMinutes: formData.get("roundingMinutes"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    console.warn("Invalid overtime policy payload", parsed.error.flatten());
    return;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return;

  try {
    await upsertOvertimePolicy(
      supabase,
      {
        houseId: parsed.data.houseId,
        minOtMinutes: parsed.data.minOtMinutes,
        roundingMinutes: parsed.data.roundingMinutes,
        roundingMode: parsed.data.roundingMode,
        timezone: parsed.data.timezone,
      },
      undefined,
    );
  } catch (error) {
    if (error instanceof OvertimePolicyError) {
      console.warn("Overtime policy update denied", error.message);
      return;
    }
    console.error("Failed to update overtime policy", error);
    return;
  }

  revalidatePath(`/company/${parsed.data.houseSlug}/hr/schedules`);
}
