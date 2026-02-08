import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  DtrSegmentRow,
  EmployeeRow,
  HrPayPolicyRow,
  HrPayrollRunDeductionRow,
  HrPayrollRunItemRow,
  HrPayrollRunRow,
} from "@/lib/db.types";
import { requireHrAccess, type HrAccessDecision } from "./access";
import { getScheduleForEmployeeOnDate, parseDateParts } from "./overtime-engine";
import { computeDailyRateBreakdown } from "./payroll-math";
import { isWorkDateMismatch, toManilaDate } from "./timezone";

export type PayPolicySnapshot = {
  houseId: string;
  minutesPerDayDefault: number;
  deriveMinutesFromSchedule: boolean;
  otMultiplier: number;
};

export type PayslipPreview = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  ratePerDay: number;
  scheduledMinutes: number;
  workMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  undertimeMinutes: number;
  perMinuteRate: number;
  regularPay: number;
  overtimePay: number;
  undertimeDeduction: number;
  otherDeductions: { label: string; amount: number }[];
  deductionsTotal: number;
  grossPay: number;
  netPay: number;
  flags: {
    missingScheduleDays: number;
    openSegment: boolean;
    absentDays: number;
    timezoneMismatchDays: number;
  };
};

export type PayslipPreviewRow = PayslipPreview & {
  employeeName: string;
  employeeCode: string;
};

export class PayslipAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayslipAccessError";
  }
}

export class PayslipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayslipValidationError";
  }
}

export class PayslipFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayslipFetchError";
  }
}

export class PayrollRunDeductionLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunDeductionLockedError";
  }
}

export class PayrollRunDeductionMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunDeductionMutationError";
  }
}

const DEFAULT_POLICY: PayPolicySnapshot = {
  houseId: "",
  minutesPerDayDefault: 480,
  deriveMinutesFromSchedule: true,
  otMultiplier: 1.0,
};

const DTR_SEGMENT_COLUMNS =
  "id, house_id, employee_id, work_date, time_in, time_out, status";

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function listDatesBetween(startDate: string, endDate: string): string[] {
  const startParts = parseDateParts(startDate);
  const endParts = parseDateParts(endDate);
  if (!startParts || !endParts) return [];

  const start = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const dates: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function resolveAccess(
  supabase: SupabaseClient<Database>,
  houseId: string,
  accessOverride?: HrAccessDecision,
): Promise<HrAccessDecision> {
  if (accessOverride) return accessOverride;
  return requireHrAccess(supabase, houseId);
}

async function loadPayrollRun(
  supabase: SupabaseClient<Database>,
  runId: string,
): Promise<HrPayrollRunRow | null> {
  const { data, error } = await supabase
    .from("hr_payroll_runs")
    .select(
      "id, house_id, period_start, period_end, status, created_by, created_at, finalized_at, finalized_by, finalize_note, posted_at, posted_by, post_note, paid_at, paid_by, payment_method, payment_note, reference_code, adjusts_run_id",
    )
    .eq("id", runId)
    .maybeSingle<HrPayrollRunRow>();

  if (error) throw new PayslipFetchError(error.message);
  return data ?? null;
}

async function loadRunItems(
  supabase: SupabaseClient<Database>,
  runId: string,
  employeeId?: string,
): Promise<HrPayrollRunItemRow[]> {
  let query = supabase
    .from("hr_payroll_run_items")
    .select(
      "id, run_id, house_id, employee_id, work_minutes, overtime_minutes_raw, overtime_minutes_rounded, missing_schedule_days, open_segment_days, corrected_segment_days, notes, created_at",
    )
    .eq("run_id", runId);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query.order("employee_id", { ascending: true });
  if (error) throw new PayslipFetchError(error.message);
  return (data as HrPayrollRunItemRow[] | null) ?? [];
}

async function loadEmployees(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeIds: string[],
): Promise<EmployeeRow[]> {
  if (employeeIds.length === 0) return [];
  const { data, error } = await supabase
    .from("employees")
    .select("id, house_id, full_name, code, rate_per_day")
    .eq("house_id", houseId)
    .in("id", employeeIds)
    .order("full_name", { ascending: true });

  if (error) throw new PayslipFetchError(error.message);
  return (data as EmployeeRow[] | null) ?? [];
}

async function loadRunDeductions(
  supabase: SupabaseClient<Database>,
  runId: string,
  employeeId: string,
): Promise<HrPayrollRunDeductionRow[]> {
  const { data, error } = await supabase
    .from("hr_payroll_run_deductions")
    .select("id, run_id, house_id, employee_id, label, amount, created_by, created_at")
    .eq("run_id", runId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: true });

  if (error) throw new PayslipFetchError(error.message);
  return (data as HrPayrollRunDeductionRow[] | null) ?? [];
}

async function loadSegmentsForPeriod(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; employeeId: string; startDate: string; endDate: string },
): Promise<DtrSegmentRow[]> {
  const { data, error } = await supabase
    .from("dtr_segments")
    .select(DTR_SEGMENT_COLUMNS)
    .eq("house_id", input.houseId)
    .eq("employee_id", input.employeeId)
    .gte("work_date", input.startDate)
    .lte("work_date", input.endDate)
    .order("work_date", { ascending: true })
    .order("time_in", { ascending: true });

  if (error) throw new PayslipFetchError(error.message);
  return (data as DtrSegmentRow[] | null) ?? [];
}

export async function getPayPolicyForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
): Promise<PayPolicySnapshot> {
  const { data, error } = await supabase
    .from("hr_pay_policies")
    .select("house_id, minutes_per_day_default, derive_minutes_from_schedule, ot_multiplier, created_at")
    .eq("house_id", houseId)
    .maybeSingle<HrPayPolicyRow>();

  if (error) throw new PayslipFetchError(error.message);

  if (!data) {
    return {
      ...DEFAULT_POLICY,
      houseId,
    };
  }

  return {
    houseId: data.house_id,
    minutesPerDayDefault: asNumber(data.minutes_per_day_default),
    deriveMinutesFromSchedule: Boolean(data.derive_minutes_from_schedule),
    otMultiplier: asNumber(data.ot_multiplier) || DEFAULT_POLICY.otMultiplier,
  };
}

async function computeScheduleMinutes(
  supabase: SupabaseClient<Database>,
  input: {
    houseId: string;
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    policy: PayPolicySnapshot;
  },
  access: HrAccessDecision,
): Promise<{ totalMinutes: number; missingScheduleDays: number; dayCount: number }> {
  const dates = listDatesBetween(input.periodStart, input.periodEnd);
  const dayCount = dates.length;
  if (dayCount === 0) {
    return { totalMinutes: 0, missingScheduleDays: 0, dayCount: 0 };
  }

  if (!input.policy.deriveMinutesFromSchedule) {
    return {
      totalMinutes: input.policy.minutesPerDayDefault * dayCount,
      missingScheduleDays: 0,
      dayCount,
    };
  }

  let totalMinutes = 0;
  let missingScheduleDays = 0;
  let scheduleDayCount = 0;

  for (const workDate of dates) {
    const schedule = await getScheduleForEmployeeOnDate(
      supabase,
      { houseId: input.houseId, employeeId: input.employeeId, workDate },
      { access },
    );

    if (schedule.status !== "ok" || !schedule.scheduledStartTs || !schedule.scheduledEndTs) {
      missingScheduleDays += 1;
      continue;
    }

    const breakdown = computeDailyRateBreakdown([], {
      scheduledStartTs: schedule.scheduledStartTs,
      scheduledEndTs: schedule.scheduledEndTs,
      breakStartTs: schedule.breakStartTs ?? null,
      breakEndTs: schedule.breakEndTs ?? null,
    });
    if (breakdown.scheduledMinutes <= 0 || breakdown.flags.includes("invalid_schedule")) {
      missingScheduleDays += 1;
    } else {
      totalMinutes += breakdown.scheduledMinutes;
      scheduleDayCount += 1;
    }
  }

  return {
    totalMinutes,
    missingScheduleDays,
    dayCount: scheduleDayCount,
  };
}

async function computeScheduleMinutesForDates(
  supabase: SupabaseClient<Database>,
  input: {
    houseId: string;
    employeeId: string;
    dates: string[];
    policy: PayPolicySnapshot;
  },
  access: HrAccessDecision,
): Promise<{ totalMinutes: number; missingScheduleDays: number; minutesByDate: Map<string, number> }> {
  if (input.dates.length === 0) {
    return { totalMinutes: 0, missingScheduleDays: 0, minutesByDate: new Map() };
  }

  if (!input.policy.deriveMinutesFromSchedule) {
    const minutesByDate = new Map<string, number>();
    input.dates.forEach((date) => {
      minutesByDate.set(date, input.policy.minutesPerDayDefault);
    });
    return {
      totalMinutes: input.policy.minutesPerDayDefault * input.dates.length,
      missingScheduleDays: 0,
      minutesByDate,
    };
  }

  let totalMinutes = 0;
  let missingScheduleDays = 0;
  const minutesByDate = new Map<string, number>();

  for (const workDate of input.dates) {
    const schedule = await getScheduleForEmployeeOnDate(
      supabase,
      { houseId: input.houseId, employeeId: input.employeeId, workDate },
      { access },
    );

    if (schedule.status !== "ok" || !schedule.scheduledStartTs || !schedule.scheduledEndTs) {
      missingScheduleDays += 1;
      minutesByDate.set(workDate, 0);
      continue;
    }

    const breakdown = computeDailyRateBreakdown([], {
      scheduledStartTs: schedule.scheduledStartTs,
      scheduledEndTs: schedule.scheduledEndTs,
      breakStartTs: schedule.breakStartTs ?? null,
      breakEndTs: schedule.breakEndTs ?? null,
    });
    if (breakdown.scheduledMinutes <= 0 || breakdown.flags.includes("invalid_schedule")) {
      missingScheduleDays += 1;
      minutesByDate.set(workDate, 0);
    } else {
      totalMinutes += breakdown.scheduledMinutes;
      minutesByDate.set(workDate, breakdown.scheduledMinutes);
    }
  }

  return { totalMinutes, missingScheduleDays, minutesByDate };
}

function computePayslipPreview(input: {
  run: HrPayrollRunRow;
  item: HrPayrollRunItemRow;
  employee: EmployeeRow;
  policy: PayPolicySnapshot;
  scheduleMinutesTotal: number;
  scheduleDayCount: number;
  missingScheduleDays: number;
  undertimeMinutes: number;
  absentDays: number;
  timezoneMismatchDays: number;
  deductions: HrPayrollRunDeductionRow[];
}): PayslipPreview {
  const ratePerDay = asNumber(input.employee.rate_per_day);
  const workMinutes = asNumber(input.item.work_minutes);
  const scheduleMinutesPerDay =
    input.scheduleDayCount > 0 ? input.scheduleMinutesTotal / input.scheduleDayCount : 0;
  const perMinuteRate =
    scheduleMinutesPerDay > 0 ? ratePerDay / scheduleMinutesPerDay : 0;

  const regularMinutes = Math.min(workMinutes, input.scheduleMinutesTotal);
  const undertimeMinutes = Math.max(input.undertimeMinutes, 0);

  const hasMissingSchedule = input.missingScheduleDays > 0;
  const overtimeMinutes = hasMissingSchedule
    ? 0
    : asNumber(input.item.overtime_minutes_rounded);

  const regularPay = perMinuteRate * regularMinutes;
  const overtimePay = perMinuteRate * overtimeMinutes * input.policy.otMultiplier;
  const undertimeDeduction = perMinuteRate * undertimeMinutes;
  const grossPay = regularPay + overtimePay;

  const otherDeductions = input.deductions.map((deduction) => ({
    label: deduction.label,
    amount: asNumber(deduction.amount),
  }));
  const deductionsTotal = otherDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);
  const netPay = grossPay - undertimeDeduction - deductionsTotal;

  return {
    employeeId: input.item.employee_id,
    periodStart: input.run.period_start,
    periodEnd: input.run.period_end,
    ratePerDay,
    scheduledMinutes: input.scheduleMinutesTotal,
    workMinutes,
    regularMinutes,
    overtimeMinutes,
    undertimeMinutes,
    perMinuteRate,
    regularPay,
    overtimePay,
    undertimeDeduction,
    otherDeductions,
    deductionsTotal,
    grossPay,
    netPay,
    flags: {
      missingScheduleDays: input.missingScheduleDays,
      openSegment: input.item.open_segment_days > 0,
      absentDays: input.absentDays,
      timezoneMismatchDays: input.timezoneMismatchDays,
    },
  };
}

export async function computePayslipsForPayrollRun(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; runId: string; employeeId?: string },
  options: { access?: HrAccessDecision } = {},
): Promise<PayslipPreviewRow[]> {
  const access = await resolveAccess(supabase, input.houseId, options.access);
  if (!access.allowed) {
    throw new PayslipAccessError("Not allowed to access payslip previews for this house.");
  }

  const run = await loadPayrollRun(supabase, input.runId);
  if (!run || run.house_id !== input.houseId) {
    throw new PayslipAccessError("Payroll run does not belong to this house.");
  }

  if (!parseDateParts(run.period_start) || !parseDateParts(run.period_end)) {
    throw new PayslipValidationError("Invalid payroll run period.");
  }

  const items = await loadRunItems(supabase, input.runId, input.employeeId);
  if (input.employeeId && items.length === 0) {
    throw new PayslipAccessError("Employee does not belong to this payroll run.");
  }

  if (items.length === 0) return [];

  const policy = await getPayPolicyForHouse(supabase, input.houseId);
  const employeeIds = Array.from(new Set(items.map((item) => item.employee_id)));
  const employees = await loadEmployees(supabase, input.houseId, employeeIds);
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

  const rows: PayslipPreviewRow[] = [];
  for (const item of items) {
    const employee = employeeMap.get(item.employee_id);
    if (!employee) continue;

    const schedule = await computeScheduleMinutes(
      supabase,
      {
        houseId: input.houseId,
        employeeId: item.employee_id,
        periodStart: run.period_start,
        periodEnd: run.period_end,
        policy,
      },
      access,
    );

    const segments = await loadSegmentsForPeriod(supabase, {
      houseId: input.houseId,
      employeeId: item.employee_id,
      startDate: run.period_start,
      endDate: run.period_end,
    });

    const mismatchDates = new Set<string>();
    const attendanceDates = new Set<string>();
    const segmentsByDate = new Map<string, DtrSegmentRow[]>();

    segments.forEach((segment) => {
      if (!segment.time_in) return;
      const manilaWorkDate = toManilaDate(segment.time_in) ?? segment.work_date;
      if (!manilaWorkDate) return;
      if (isWorkDateMismatch(segment.work_date, segment.time_in, segment.time_out)) {
        mismatchDates.add(segment.work_date ?? manilaWorkDate);
      }
      attendanceDates.add(manilaWorkDate);
      const bucket = segmentsByDate.get(manilaWorkDate) ?? [];
      bucket.push(segment);
      segmentsByDate.set(manilaWorkDate, bucket);
    });

    const workedMinutesByDate = new Map<string, number>();
    for (const date of attendanceDates) {
      const schedule = await getScheduleForEmployeeOnDate(
        supabase,
        { houseId: input.houseId, employeeId: item.employee_id, workDate: date },
        { access },
      );
      const breakdown = computeDailyRateBreakdown(
        segmentsByDate.get(date) ?? [],
        schedule.status === "ok"
          ? {
              scheduledStartTs: schedule.scheduledStartTs,
              scheduledEndTs: schedule.scheduledEndTs,
              breakStartTs: schedule.breakStartTs ?? null,
              breakEndTs: schedule.breakEndTs ?? null,
            }
          : null,
      );
      workedMinutesByDate.set(date, breakdown.regularMinutes);
    }
    const allDates = listDatesBetween(run.period_start, run.period_end);
    const absentDays = allDates.filter((date) => !attendanceDates.has(date)).length;
    const attendedDateList = Array.from(attendanceDates).sort();

    const scheduleForAttendance = await computeScheduleMinutesForDates(
      supabase,
      {
        houseId: input.houseId,
        employeeId: item.employee_id,
        dates: attendedDateList,
        policy,
      },
      access,
    );

    let undertimeMinutes = 0;
    attendedDateList.forEach((date) => {
      const scheduledMinutes = scheduleForAttendance.minutesByDate.get(date) ?? 0;
      if (scheduledMinutes <= 0) return;
      const workedMinutes = workedMinutesByDate.get(date) ?? 0;
      if (workedMinutes < scheduledMinutes) {
        undertimeMinutes += scheduledMinutes - workedMinutes;
      }
    });

    const deductions = await loadRunDeductions(supabase, input.runId, item.employee_id);
    const preview = computePayslipPreview({
      run,
      item,
      employee,
      policy,
      scheduleMinutesTotal: schedule.totalMinutes,
      scheduleDayCount: schedule.dayCount,
      missingScheduleDays: schedule.missingScheduleDays,
      undertimeMinutes,
      absentDays,
      timezoneMismatchDays: mismatchDates.size,
      deductions,
    });

    rows.push({
      ...preview,
      employeeName: employee.full_name,
      employeeCode: employee.code,
    });
  }

  return rows;
}

export async function computePayslipForPayrollRunEmployee(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; runId: string; employeeId: string },
  options: { access?: HrAccessDecision } = {},
): Promise<PayslipPreview> {
  const rows = await computePayslipsForPayrollRun(
    supabase,
    { houseId: input.houseId, runId: input.runId, employeeId: input.employeeId },
    options,
  );

  if (!rows[0]) {
    throw new PayslipAccessError("Payslip preview not found for employee.");
  }

  const preview = { ...rows[0] } as PayslipPreviewRow;
  delete (preview as Partial<PayslipPreviewRow>).employeeName;
  delete (preview as Partial<PayslipPreviewRow>).employeeCode;
  return preview;
}

export async function createPayrollRunDeduction(
  supabase: SupabaseClient<Database>,
  input: {
    runId: string;
    employeeId: string;
    label: string;
    amount: number;
    createdBy: string;
    houseId?: string;
  },
  options: { access?: HrAccessDecision } = {},
): Promise<{ id: string } | null> {
  const run = await loadPayrollRun(supabase, input.runId);
  if (!run) {
    throw new PayslipAccessError("Payroll run not found.");
  }

  const houseId = input.houseId ?? run.house_id;
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) {
    throw new PayslipAccessError("Not allowed to add deductions for this payroll run.");
  }

  if (run.house_id !== houseId) {
    throw new PayslipAccessError("Payroll run does not belong to this house.");
  }

  if (run.status === "posted" || run.status === "paid") {
    throw new PayrollRunDeductionLockedError("Payroll run is posted/paid and cannot accept deductions.");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, house_id")
    .eq("id", input.employeeId)
    .maybeSingle<{ id: string; house_id: string | null }>();

  if (employeeError) {
    throw new PayrollRunDeductionMutationError(employeeError.message);
  }

  if (!employee || employee.house_id !== houseId) {
    throw new PayslipAccessError("Employee does not belong to this house.");
  }

  const { data, error } = await supabase
    .from("hr_payroll_run_deductions")
    .insert({
      run_id: run.id,
      house_id: houseId,
      employee_id: input.employeeId,
      label: input.label,
      amount: input.amount,
      created_by: input.createdBy,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new PayrollRunDeductionMutationError(error.message);
  }

  return data ?? null;
}
