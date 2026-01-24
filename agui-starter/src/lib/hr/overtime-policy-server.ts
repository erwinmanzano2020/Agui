import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  EmployeeRow,
  HrBranchScheduleAssignmentRow,
  HrOvertimePolicyRow,
  HrScheduleTemplateRow,
  HrScheduleWindowRow,
} from "@/lib/db.types";
import { requireHrAccess, type HrAccessDecision } from "./access";
import { listDtrByHouseAndDate } from "./dtr-segments-server";
import {
  computeOvertimeForDay,
  getDayOfWeekInTimeZone,
  type OvertimeComputationResult,
  type OvertimePolicyInput,
  type ScheduleWindowInput,
} from "./overtime-engine";

const POLICY_COLUMNS =
  "house_id, timezone, ot_mode, min_ot_minutes, rounding_minutes, rounding_mode, created_at";
const EMPLOYEE_COLUMNS = "id, house_id, branch_id";
const ASSIGNMENT_COLUMNS = "id, house_id, branch_id, schedule_id, effective_from, created_at";
const TEMPLATE_COLUMNS = "id, house_id, timezone";
const WINDOW_COLUMNS =
  "id, house_id, schedule_id, day_of_week, start_time, end_time, break_start, break_end, created_at";

export type DailyComputedDtr = OvertimeComputationResult & {
  house_id: string;
  employee_id: string;
  work_date: string;
};

export type OvertimePolicy = OvertimePolicyInput & {
  house_id: string;
  created_at: string;
};

type ScheduleResolution = {
  scheduleWindow: ScheduleWindowInput | null;
  warnings: string[];
};

function resolvePolicyDefaults(
  houseId: string,
  row?: HrOvertimePolicyRow | null,
): OvertimePolicy {
  const fallback = {
    house_id: houseId,
    timezone: "Asia/Manila",
    ot_mode: "AFTER_SCHEDULE_END",
    min_ot_minutes: 10,
    rounding_minutes: 1,
    rounding_mode: "NONE",
    created_at: new Date().toISOString(),
  } satisfies OvertimePolicy;

  if (!row) return fallback;
  return {
    house_id: row.house_id,
    timezone: row.timezone ?? fallback.timezone,
    ot_mode: row.ot_mode ?? fallback.ot_mode,
    min_ot_minutes: Number(row.min_ot_minutes ?? fallback.min_ot_minutes),
    rounding_minutes: Number(row.rounding_minutes ?? fallback.rounding_minutes),
    rounding_mode: row.rounding_mode ?? fallback.rounding_mode,
    created_at: row.created_at ?? fallback.created_at,
  };
}

async function resolveAccess(
  supabase: SupabaseClient<Database>,
  houseId: string,
  accessOverride?: HrAccessDecision,
): Promise<HrAccessDecision> {
  if (accessOverride) return accessOverride;
  return requireHrAccess(supabase, houseId);
}

async function loadOvertimePolicy(
  supabase: SupabaseClient<Database>,
  houseId: string,
): Promise<OvertimePolicy> {
  const { data, error } = await supabase
    .from("hr_overtime_policies")
    .select(POLICY_COLUMNS)
    .eq("house_id", houseId)
    .maybeSingle<HrOvertimePolicyRow>();

  if (error) {
    throw new Error(error.message);
  }

  return resolvePolicyDefaults(houseId, data);
}

async function resolveScheduleWindowForEmployee(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; employeeId: string; workDate: string; timeZone: string },
): Promise<ScheduleResolution> {
  const warnings: string[] = [];
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", input.employeeId)
    .maybeSingle<EmployeeRow>();

  if (employeeError) throw new Error(employeeError.message);

  if (!employee || employee.house_id !== input.houseId) {
    warnings.push("employee not found for house");
    return { scheduleWindow: null, warnings };
  }

  if (!employee.branch_id) {
    warnings.push("employee missing branch assignment");
    return { scheduleWindow: null, warnings };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("hr_branch_schedule_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("house_id", input.houseId)
    .eq("branch_id", employee.branch_id)
    .lte("effective_from", input.workDate)
    .order("effective_from", { ascending: false });

  if (assignmentError) throw new Error(assignmentError.message);

  const assignment = (assignments as HrBranchScheduleAssignmentRow[] | null)?.[0] ?? null;
  if (!assignment) {
    warnings.push("missing schedule assignment");
    return { scheduleWindow: null, warnings };
  }

  const { data: template, error: templateError } = await supabase
    .from("hr_schedule_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("house_id", input.houseId)
    .eq("id", assignment.schedule_id)
    .maybeSingle<HrScheduleTemplateRow>();

  if (templateError) throw new Error(templateError.message);
  if (!template) {
    warnings.push("missing schedule template");
    return { scheduleWindow: null, warnings };
  }

  const scheduleTimezone = template.timezone ?? input.timeZone;
  const dayOfWeek = getDayOfWeekInTimeZone(input.workDate, scheduleTimezone);
  if (dayOfWeek === null) {
    warnings.push("invalid work date");
    return { scheduleWindow: null, warnings };
  }

  const { data: windows, error: windowError } = await supabase
    .from("hr_schedule_windows")
    .select(WINDOW_COLUMNS)
    .eq("house_id", input.houseId)
    .eq("schedule_id", assignment.schedule_id)
    .eq("day_of_week", dayOfWeek)
    .order("start_time", { ascending: true });

  if (windowError) throw new Error(windowError.message);

  const window = (windows as HrScheduleWindowRow[] | null)?.[0] ?? null;
  if (!window) {
    return { scheduleWindow: null, warnings };
  }

  return {
    scheduleWindow: {
      start_time: window.start_time,
      end_time: window.end_time,
      timezone: scheduleTimezone,
    },
    warnings,
  };
}

export async function getDailyComputedDtrForEmployee(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeId: string,
  workDate: string,
  options: { access?: HrAccessDecision } = {},
): Promise<DailyComputedDtr | null> {
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) return null;

  const segments = await listDtrByHouseAndDate(supabase, houseId, workDate, { employeeId });
  const policy = await loadOvertimePolicy(supabase, houseId);
  const scheduleResolution = await resolveScheduleWindowForEmployee(supabase, {
    houseId,
    employeeId,
    workDate,
    timeZone: policy.timezone,
  });

  const computed = computeOvertimeForDay({
    segments,
    workDate,
    scheduleWindow: scheduleResolution.scheduleWindow,
    policy,
  });

  return {
    house_id: houseId,
    employee_id: employeeId,
    work_date: workDate,
    ...computed,
    warnings: [...scheduleResolution.warnings, ...computed.warnings],
  };
}
