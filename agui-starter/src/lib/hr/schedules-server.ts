import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  HrBranchScheduleAssignmentRow,
  HrScheduleTemplateRow,
  HrScheduleWindowRow,
} from "@/lib/db.types";
import { requireHrAccess, type HrAccessDecision } from "./access";

const TEMPLATE_COLUMNS = "id, house_id, name, timezone, created_at";
const WINDOW_COLUMNS =
  "id, house_id, schedule_id, day_of_week, start_time, end_time, break_start, break_end, created_at";
const ASSIGNMENT_COLUMNS =
  "id, house_id, branch_id, schedule_id, effective_from, created_at";

export type ScheduleTemplateWithWindows = {
  template: HrScheduleTemplateRow;
  windows: HrScheduleWindowRow[];
};

export class ScheduleAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleAssignmentError";
  }
}

async function resolveAccess(
  supabase: SupabaseClient<Database>,
  houseId: string,
  accessOverride?: HrAccessDecision,
): Promise<HrAccessDecision> {
  if (accessOverride) return accessOverride;
  return requireHrAccess(supabase, houseId);
}

export async function listScheduleTemplates(
  supabase: SupabaseClient<Database>,
  houseId: string,
  options: { access?: HrAccessDecision } = {},
): Promise<HrScheduleTemplateRow[]> {
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) return [];

  const { data, error } = await supabase
    .from("hr_schedule_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("house_id", houseId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as HrScheduleTemplateRow[] | null) ?? [];
}

export async function getScheduleTemplateWithWindows(
  supabase: SupabaseClient<Database>,
  houseId: string,
  scheduleId: string,
  options: { access?: HrAccessDecision } = {},
): Promise<ScheduleTemplateWithWindows | null> {
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) return null;

  const { data: template, error } = await supabase
    .from("hr_schedule_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("house_id", houseId)
    .eq("id", scheduleId)
    .maybeSingle<HrScheduleTemplateRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!template) return null;

  const { data: windows, error: windowsError } = await supabase
    .from("hr_schedule_windows")
    .select(WINDOW_COLUMNS)
    .eq("house_id", houseId)
    .eq("schedule_id", scheduleId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (windowsError) {
    throw new Error(windowsError.message);
  }

  return { template, windows: (windows as HrScheduleWindowRow[] | null) ?? [] };
}

export async function listBranchScheduleAssignments(
  supabase: SupabaseClient<Database>,
  houseId: string,
  branchId?: string,
  options: { access?: HrAccessDecision } = {},
): Promise<HrBranchScheduleAssignmentRow[]> {
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) return [];

  let query = supabase
    .from("hr_branch_schedule_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("house_id", houseId);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query.order("effective_from", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as HrBranchScheduleAssignmentRow[] | null) ?? [];
}

export async function createBranchScheduleAssignment(
  supabase: SupabaseClient<Database>,
  input: {
    houseId: string;
    branchId: string;
    scheduleId: string;
    effectiveFrom: string;
  },
  options: { access?: HrAccessDecision } = {},
): Promise<HrBranchScheduleAssignmentRow> {
  const access = await resolveAccess(supabase, input.houseId, options.access);
  if (!access.allowed) {
    throw new ScheduleAssignmentError("Not allowed to assign schedules for this house.");
  }

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, house_id")
    .eq("id", input.branchId)
    .maybeSingle<{ id: string; house_id: string | null }>();

  if (branchError) {
    throw new Error(branchError.message);
  }

  if (!branch?.house_id) {
    throw new ScheduleAssignmentError("Branch was not found for schedule assignment.");
  }

  const { data: template, error: templateError } = await supabase
    .from("hr_schedule_templates")
    .select("id, house_id")
    .eq("id", input.scheduleId)
    .maybeSingle<{ id: string; house_id: string | null }>();

  if (templateError) {
    throw new Error(templateError.message);
  }

  if (!template?.house_id) {
    throw new ScheduleAssignmentError("Schedule template was not found for assignment.");
  }

  if (branch.house_id !== input.houseId || template.house_id !== input.houseId) {
    throw new ScheduleAssignmentError("Schedule and branch must belong to the same house.");
  }

  const { data, error } = await supabase
    .from("hr_branch_schedule_assignments")
    .insert({
      house_id: input.houseId,
      branch_id: input.branchId,
      schedule_id: input.scheduleId,
      effective_from: input.effectiveFrom,
    })
    .select(ASSIGNMENT_COLUMNS)
    .maybeSingle<HrBranchScheduleAssignmentRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Failed to assign schedule to branch.");
  }

  return data;
}
