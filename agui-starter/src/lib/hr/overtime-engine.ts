import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  DtrSegmentRow,
  EmployeeRow,
  HrBranchScheduleAssignmentRow,
  HrOvertimePolicyRow,
  HrScheduleWindowRow,
} from "@/lib/db.types";
import { requireHrAccess, type HrAccessDecision } from "./access";

export type OvertimePolicyInput = {
  timezone: string;
  ot_mode: string;
  min_ot_minutes: number;
  rounding_minutes: number;
  rounding_mode: string;
};

export type ScheduleWindowInput = {
  start_time: string;
  end_time: string;
  timezone: string;
};

export type OvertimeSegmentInput = {
  time_in: string | null;
  time_out: string | null;
};

export type OvertimeComputationResult = {
  worked_minutes_total: number;
  worked_minutes_within_schedule: number;
  overtime_minutes: number;
  open_segments_count: number;
  warnings: string[];
};

export type ScheduleResolution =
  | {
      status: "ok";
      scheduleId: string;
      templateId: string;
      windowId: string;
      scheduledStartTs: string;
      scheduledEndTs: string;
      breakStartTs?: string | null;
      breakEndTs?: string | null;
      timeZone: string;
    }
  | { status: "no_schedule"; reason?: string };

export type DailyOvertimeResult = {
  employeeId: string;
  workDate: string;
  scheduleStatus: "ok" | "no_schedule";
  scheduledEndTs: string | null;
  rawOtMinutes: number;
  finalOtMinutes: number;
  roundingApplied: boolean;
  minThresholdApplied: boolean;
  reasons: string[];
};

type DateParts = { year: number; month: number; day: number };
type TimeParts = { hour: number; minute: number; second: number };

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const DEFAULT_TIMEZONE = "Asia/Manila";
const DEFAULT_POLICY = {
  timezone: DEFAULT_TIMEZONE,
  ot_mode: "AFTER_SCHEDULE_END",
  min_ot_minutes: 10,
  rounding_minutes: 1,
  rounding_mode: "NONE",
} satisfies OvertimePolicyInput;

export function parseDateParts(date: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

export function parseTimeParts(time: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
  return { hour, minute, second };
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getTimeZoneOffsetMs(timeZone: string, utcDate: Date): number {
  const parts = getFormatter(timeZone).formatToParts(utcDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const second = Number(values.second);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return localAsUtc - utcDate.getTime();
}

export function buildZonedDateTime(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const dateParts = parseDateParts(date);
  const timeParts = parseTimeParts(time);
  if (!dateParts || !timeParts) return null;
  const { year, month, day } = dateParts;
  const { hour, minute, second } = timeParts;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMs(timeZone, utcGuess);
  let adjusted = new Date(utcGuess.getTime() - offset);
  const nextOffset = getTimeZoneOffsetMs(timeZone, adjusted);
  if (nextOffset !== offset) {
    adjusted = new Date(utcGuess.getTime() - nextOffset);
  }
  return adjusted;
}

export function getDayOfWeekInTimeZone(date: string, timeZone: string): number | null {
  const midday = buildZonedDateTime(date, "12:00", timeZone);
  if (!midday) return null;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(midday);
  return WEEKDAY_MAP[weekday] ?? null;
}

function diffMinutes(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  if (endMs <= startMs) return 0;
  return Math.floor((endMs - startMs) / 60000);
}

function applyRounding(minutes: number, roundingMinutes: number, mode: string): number {
  if (roundingMinutes <= 1 || mode === "NONE") return minutes;
  const ratio = minutes / roundingMinutes;
  if (mode === "FLOOR") return Math.floor(ratio) * roundingMinutes;
  if (mode === "CEIL") return Math.ceil(ratio) * roundingMinutes;
  if (mode === "NEAREST") return Math.round(ratio) * roundingMinutes;
  return minutes;
}

function normalizeRoundingMode(mode: string | null | undefined): "none" | "ceil" | "floor" | "nearest" {
  switch ((mode ?? "").toLowerCase()) {
    case "ceil":
      return "ceil";
    case "floor":
      return "floor";
    case "nearest":
      return "nearest";
    default:
      return "none";
  }
}

function applyRoundingPolicy(
  minutes: number,
  roundingMinutes: number,
  mode: "none" | "ceil" | "floor" | "nearest",
): number {
  if (roundingMinutes <= 1 || mode === "none") return minutes;
  const ratio = minutes / roundingMinutes;
  if (mode === "floor") return Math.floor(ratio) * roundingMinutes;
  if (mode === "ceil") return Math.ceil(ratio) * roundingMinutes;
  return Math.round(ratio) * roundingMinutes;
}

type SegmentInput = Pick<DtrSegmentRow, "time_in" | "time_out">;

function computeRawOvertimeMinutes(
  segments: SegmentInput[],
  scheduleEndMs: number,
  reasons: string[],
): number {
  let total = 0;
  let hasOpenSegment = false;

  segments.forEach((segment) => {
    if (!segment.time_out || !segment.time_in) {
      if (!segment.time_out) hasOpenSegment = true;
      return;
    }
    const startMs = Date.parse(segment.time_in);
    const endMs = Date.parse(segment.time_out);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
    if (endMs <= startMs) return;

    const overtimeStart = Math.max(startMs, scheduleEndMs);
    total += diffMinutes(overtimeStart, endMs);
  });

  if (hasOpenSegment) {
    reasons.push("open_segment");
  }

  return total;
}

function resolvePolicyDefaults(row?: HrOvertimePolicyRow | null): OvertimePolicyInput {
  if (!row) return DEFAULT_POLICY;
  return {
    timezone: row.timezone ?? DEFAULT_POLICY.timezone,
    ot_mode: row.ot_mode ?? DEFAULT_POLICY.ot_mode,
    min_ot_minutes: Number(row.min_ot_minutes ?? DEFAULT_POLICY.min_ot_minutes),
    rounding_minutes: Number(row.rounding_minutes ?? DEFAULT_POLICY.rounding_minutes),
    rounding_mode: row.rounding_mode ?? DEFAULT_POLICY.rounding_mode,
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
): Promise<OvertimePolicyInput> {
  const { data, error } = await supabase
    .from("hr_overtime_policies")
    .select("house_id, timezone, ot_mode, min_ot_minutes, rounding_minutes, rounding_mode, created_at")
    .eq("house_id", houseId)
    .maybeSingle<HrOvertimePolicyRow>();

  if (error) {
    throw new Error(error.message);
  }

  return resolvePolicyDefaults(data);
}

async function loadEmployees(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeIds?: string[],
): Promise<EmployeeRow[]> {
  let query = supabase
    .from("employees")
    .select("id, house_id, branch_id")
    .eq("house_id", houseId);

  if (employeeIds && employeeIds.length > 0) {
    query = query.in("id", employeeIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data as EmployeeRow[] | null) ?? [];
}

async function loadSegments(
  supabase: SupabaseClient<Database>,
  houseId: string,
  workDate: string,
  employeeIds?: string[],
): Promise<DtrSegmentRow[]> {
  let query = supabase
    .from("dtr_segments")
    .select("id, house_id, employee_id, work_date, time_in, time_out")
    .eq("house_id", houseId)
    .eq("work_date", workDate);

  if (employeeIds && employeeIds.length > 0) {
    query = query.in("employee_id", employeeIds);
  }

  const { data, error } = await query.order("time_in", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data as DtrSegmentRow[] | null) ?? [];
}

async function loadAssignments(
  supabase: SupabaseClient<Database>,
  houseId: string,
  branchIds: string[],
  workDate: string,
): Promise<HrBranchScheduleAssignmentRow[]> {
  if (branchIds.length === 0) return [];
  const { data, error } = await supabase
    .from("hr_branch_schedule_assignments")
    .select("id, house_id, branch_id, schedule_id, effective_from, created_at")
    .eq("house_id", houseId)
    .in("branch_id", branchIds)
    .lte("effective_from", workDate)
    .order("effective_from", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as HrBranchScheduleAssignmentRow[] | null) ?? [];
}

async function loadScheduleWindows(
  supabase: SupabaseClient<Database>,
  houseId: string,
  scheduleIds: string[],
  dayOfWeek: number,
): Promise<HrScheduleWindowRow[]> {
  if (scheduleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("hr_schedule_windows")
    .select("id, house_id, schedule_id, day_of_week, start_time, end_time, break_start, break_end")
    .eq("house_id", houseId)
    .in("schedule_id", scheduleIds)
    .eq("day_of_week", dayOfWeek)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as HrScheduleWindowRow[] | null) ?? [];
}

export async function getScheduleForEmployeeOnDate(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; employeeId: string; workDate: string },
  options: { access?: HrAccessDecision } = {},
): Promise<ScheduleResolution> {
  const access = await resolveAccess(supabase, input.houseId, options.access);
  if (!access.allowed) {
    return { status: "no_schedule", reason: "access_denied" };
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, house_id, branch_id")
    .eq("id", input.employeeId)
    .maybeSingle<EmployeeRow>();

  if (employeeError) throw new Error(employeeError.message);
  if (!employee || employee.house_id !== input.houseId) {
    return { status: "no_schedule", reason: "employee_not_found" };
  }
  if (!employee.branch_id) {
    return { status: "no_schedule", reason: "no_branch" };
  }

  const assignments = await loadAssignments(
    supabase,
    input.houseId,
    [employee.branch_id],
    input.workDate,
  );
  const assignment = assignments[0];
  if (!assignment) {
    return { status: "no_schedule", reason: "no_assignment" };
  }

  const dayOfWeek = getDayOfWeekInTimeZone(input.workDate, DEFAULT_TIMEZONE);
  if (dayOfWeek === null) {
    return { status: "no_schedule", reason: "invalid_date" };
  }

  const windows = await loadScheduleWindows(
    supabase,
    input.houseId,
    [assignment.schedule_id],
    dayOfWeek,
  );
  const window = windows[0];
  if (!window) {
    return { status: "no_schedule", reason: "no_window" };
  }

  const scheduledStart = buildZonedDateTime(input.workDate, window.start_time, DEFAULT_TIMEZONE);
  const scheduledEnd = buildZonedDateTime(input.workDate, window.end_time, DEFAULT_TIMEZONE);
  if (!scheduledStart || !scheduledEnd) {
    return { status: "no_schedule", reason: "invalid_schedule_time" };
  }
  const scheduledBreakStart =
    window.break_start && window.break_end
      ? buildZonedDateTime(input.workDate, window.break_start, DEFAULT_TIMEZONE)
      : null;
  const scheduledBreakEnd =
    window.break_start && window.break_end
      ? buildZonedDateTime(input.workDate, window.break_end, DEFAULT_TIMEZONE)
      : null;

  return {
    status: "ok",
    scheduleId: assignment.schedule_id,
    templateId: assignment.schedule_id,
    windowId: window.id,
    scheduledStartTs: scheduledStart.toISOString(),
    scheduledEndTs: scheduledEnd.toISOString(),
    breakStartTs: scheduledBreakStart ? scheduledBreakStart.toISOString() : null,
    breakEndTs: scheduledBreakEnd ? scheduledBreakEnd.toISOString() : null,
    timeZone: DEFAULT_TIMEZONE,
  };
}

export async function computeDailyOvertime(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; employeeId: string; workDate: string },
  options: { access?: HrAccessDecision } = {},
): Promise<DailyOvertimeResult | null> {
  const access = await resolveAccess(supabase, input.houseId, options.access);
  if (!access.allowed) return null;

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, house_id, branch_id")
    .eq("id", input.employeeId)
    .maybeSingle<EmployeeRow>();

  if (employeeError) throw new Error(employeeError.message);
  if (!employee || employee.house_id !== input.houseId) return null;

  const [segments, policy, schedule] = await Promise.all([
    loadSegments(supabase, input.houseId, input.workDate, [input.employeeId]),
    loadOvertimePolicy(supabase, input.houseId),
    getScheduleForEmployeeOnDate(supabase, input, { access }),
  ]);

  if (schedule.status !== "ok") {
    return {
      employeeId: input.employeeId,
      workDate: input.workDate,
      scheduleStatus: "no_schedule",
      scheduledEndTs: null,
      rawOtMinutes: 0,
      finalOtMinutes: 0,
      roundingApplied: false,
      minThresholdApplied: false,
      reasons: ["no_schedule"],
    };
  }

  const reasons: string[] = [];
  const scheduleEndMs = Date.parse(schedule.scheduledEndTs);
  const rawOtMinutes = computeRawOvertimeMinutes(segments, scheduleEndMs, reasons);
  const minThresholdApplied = rawOtMinutes < policy.min_ot_minutes;
  let finalOtMinutes = minThresholdApplied ? 0 : rawOtMinutes;
  const roundingMode = normalizeRoundingMode(policy.rounding_mode);

  if (minThresholdApplied) {
    reasons.push("below_minimum");
  } else {
    finalOtMinutes = applyRoundingPolicy(finalOtMinutes, policy.rounding_minutes, roundingMode);
  }

  const roundingApplied =
    !minThresholdApplied &&
    roundingMode !== "none" &&
    policy.rounding_minutes > 1 &&
    finalOtMinutes !== rawOtMinutes;

  return {
    employeeId: input.employeeId,
    workDate: input.workDate,
    scheduleStatus: "ok",
    scheduledEndTs: schedule.scheduledEndTs,
    rawOtMinutes,
    finalOtMinutes,
    roundingApplied,
    minThresholdApplied,
    reasons,
  };
}

export async function computeOvertimeForHouseDate(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; workDate: string; employeeIds?: string[] },
  options: { access?: HrAccessDecision } = {},
): Promise<DailyOvertimeResult[]> {
  const access = await resolveAccess(supabase, input.houseId, options.access);
  if (!access.allowed) return [];

  const employees = await loadEmployees(supabase, input.houseId, input.employeeIds);
  if (employees.length === 0) return [];

  const [segments, policy] = await Promise.all([
    loadSegments(
      supabase,
      input.houseId,
      input.workDate,
      employees.map((employee) => employee.id),
    ),
    loadOvertimePolicy(supabase, input.houseId),
  ]);

  const branchIds = Array.from(
    new Set(
      employees
        .map((employee) => employee.branch_id)
        .filter((branchId): branchId is string => Boolean(branchId)),
    ),
  );

  const assignments = await loadAssignments(supabase, input.houseId, branchIds, input.workDate);
  const assignmentByBranch = new Map<string, HrBranchScheduleAssignmentRow>();
  assignments.forEach((assignment) => {
    if (!assignmentByBranch.has(assignment.branch_id)) {
      assignmentByBranch.set(assignment.branch_id, assignment);
    }
  });

  const dayOfWeek = getDayOfWeekInTimeZone(input.workDate, DEFAULT_TIMEZONE);
  const scheduleIds = Array.from(
    new Set(assignments.map((assignment) => assignment.schedule_id).filter(Boolean)),
  );
  const windows =
    dayOfWeek === null
      ? []
      : await loadScheduleWindows(supabase, input.houseId, scheduleIds, dayOfWeek);
  const windowBySchedule = new Map<string, HrScheduleWindowRow>();
  windows.forEach((window) => {
    if (!windowBySchedule.has(window.schedule_id)) {
      windowBySchedule.set(window.schedule_id, window);
    }
  });

  const segmentsByEmployee = new Map<string, SegmentInput[]>();
  segments.forEach((segment) => {
    const bucket = segmentsByEmployee.get(segment.employee_id) ?? [];
    bucket.push(segment);
    segmentsByEmployee.set(segment.employee_id, bucket);
  });

  return employees.map((employee) => {
    const reasons: string[] = [];
    const assignment = employee.branch_id ? assignmentByBranch.get(employee.branch_id) : null;
    const window = assignment ? windowBySchedule.get(assignment.schedule_id) : null;
    const scheduledEnd = window
      ? buildZonedDateTime(input.workDate, window.end_time, DEFAULT_TIMEZONE)
      : null;

    if (!assignment || !window || !scheduledEnd) {
      return {
        employeeId: employee.id,
        workDate: input.workDate,
        scheduleStatus: "no_schedule",
        scheduledEndTs: null,
        rawOtMinutes: 0,
        finalOtMinutes: 0,
        roundingApplied: false,
        minThresholdApplied: false,
        reasons: ["no_schedule"],
      } satisfies DailyOvertimeResult;
    }

    const scheduleEndMs = scheduledEnd.getTime();
    const rawOtMinutes = computeRawOvertimeMinutes(
      segmentsByEmployee.get(employee.id) ?? [],
      scheduleEndMs,
      reasons,
    );

    const minThresholdApplied = rawOtMinutes < policy.min_ot_minutes;
    let finalOtMinutes = minThresholdApplied ? 0 : rawOtMinutes;
    const roundingMode = normalizeRoundingMode(policy.rounding_mode);
    if (minThresholdApplied) {
      reasons.push("below_minimum");
    } else {
      finalOtMinutes = applyRoundingPolicy(finalOtMinutes, policy.rounding_minutes, roundingMode);
    }

    const roundingApplied =
      !minThresholdApplied &&
      roundingMode !== "none" &&
      policy.rounding_minutes > 1 &&
      finalOtMinutes !== rawOtMinutes;

    return {
      employeeId: employee.id,
      workDate: input.workDate,
      scheduleStatus: "ok",
      scheduledEndTs: scheduledEnd.toISOString(),
      rawOtMinutes,
      finalOtMinutes,
      roundingApplied,
      minThresholdApplied,
      reasons,
    } satisfies DailyOvertimeResult;
  });
}

export function computeOvertimeForDay(input: {
  segments: OvertimeSegmentInput[];
  workDate: string;
  scheduleWindow: ScheduleWindowInput | null;
  policy: OvertimePolicyInput;
}): OvertimeComputationResult {
  const warnings: string[] = [];
  let workedMinutesTotal = 0;
  let workedMinutesWithinSchedule = 0;
  let overtimeMinutes = 0;
  let openSegmentsCount = 0;

  const scheduleStart =
    input.scheduleWindow
      ? buildZonedDateTime(input.workDate, input.scheduleWindow.start_time, input.scheduleWindow.timezone)
      : null;
  const scheduleEnd =
    input.scheduleWindow
      ? buildZonedDateTime(input.workDate, input.scheduleWindow.end_time, input.scheduleWindow.timezone)
      : null;

  if (!input.scheduleWindow || !scheduleStart || !scheduleEnd) {
    warnings.push("missing schedule window");
  }

  input.segments.forEach((segment, index) => {
    if (!segment.time_in || !segment.time_out) {
      if (!segment.time_out) openSegmentsCount += 1;
      warnings.push(`segment ${index + 1} missing time_in/time_out`);
      return;
    }
    const startMs = Date.parse(segment.time_in);
    const endMs = Date.parse(segment.time_out);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      warnings.push(`segment ${index + 1} has invalid timestamps`);
      return;
    }
    if (endMs <= startMs) {
      warnings.push(`segment ${index + 1} has non-positive duration`);
      return;
    }
    workedMinutesTotal += diffMinutes(startMs, endMs);

    if (scheduleStart && scheduleEnd) {
      const withinStart = Math.max(startMs, scheduleStart.getTime());
      const withinEnd = Math.min(endMs, scheduleEnd.getTime());
      workedMinutesWithinSchedule += diffMinutes(withinStart, withinEnd);

      if (input.policy.ot_mode === "AFTER_SCHEDULE_END") {
        const overtimeStart = Math.max(startMs, scheduleEnd.getTime());
        overtimeMinutes += diffMinutes(overtimeStart, endMs);
      }
    }
  });

  if (input.policy.ot_mode !== "AFTER_SCHEDULE_END") {
    warnings.push(`unsupported ot_mode ${input.policy.ot_mode}`);
  }

  if (overtimeMinutes < input.policy.min_ot_minutes) {
    overtimeMinutes = 0;
  }
  overtimeMinutes = applyRounding(
    overtimeMinutes,
    input.policy.rounding_minutes,
    input.policy.rounding_mode,
  );

  return {
    worked_minutes_total: workedMinutesTotal,
    worked_minutes_within_schedule: scheduleStart && scheduleEnd ? workedMinutesWithinSchedule : 0,
    overtime_minutes: overtimeMinutes,
    open_segments_count: openSegmentsCount,
    warnings,
  };
}
