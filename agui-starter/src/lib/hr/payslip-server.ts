import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  EmployeeRow,
  HrPayPolicyRow,
  HrPayrollRunDeductionRow,
  HrPayrollRunItemRow,
  HrPayrollRunRow,
} from "@/lib/db.types";
import { requireHrAccess, type HrAccessDecision } from "./access";
import { getScheduleForEmployeeOnDate, parseDateParts } from "./overtime-engine";

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
  flags: { missingScheduleDays: number; openSegment: boolean };
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

export class PayrollRunDeductionFinalizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunDeductionFinalizedError";
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

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function diffMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end.getTime() <= start.getTime()) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 60000);
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
      "id, house_id, period_start, period_end, status, created_by, created_at, finalized_at, finalized_by, finalize_note",
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

  for (const workDate of dates) {
    const schedule = await getScheduleForEmployeeOnDate(
      supabase,
      { houseId: input.houseId, employeeId: input.employeeId, workDate },
      { access },
    );

    if (schedule.status !== "ok" || !schedule.scheduledStartTs || !schedule.scheduledEndTs) {
      missingScheduleDays += 1;
      totalMinutes += input.policy.minutesPerDayDefault;
      continue;
    }

    const minutes = diffMinutes(schedule.scheduledStartTs, schedule.scheduledEndTs);
    if (minutes <= 0) {
      missingScheduleDays += 1;
      totalMinutes += input.policy.minutesPerDayDefault;
    } else {
      totalMinutes += minutes;
    }
  }

  return { totalMinutes, missingScheduleDays, dayCount };
}

function computePayslipPreview(input: {
  run: HrPayrollRunRow;
  item: HrPayrollRunItemRow;
  employee: EmployeeRow;
  policy: PayPolicySnapshot;
  scheduleMinutesTotal: number;
  scheduleDayCount: number;
  missingScheduleDays: number;
  deductions: HrPayrollRunDeductionRow[];
}): PayslipPreview {
  const ratePerDay = asNumber(input.employee.rate_per_day);
  const workMinutes = asNumber(input.item.work_minutes);
  const scheduleMinutesPerDay =
    input.scheduleDayCount > 0
      ? input.scheduleMinutesTotal / input.scheduleDayCount
      : input.policy.minutesPerDayDefault;
  const perMinuteRate =
    scheduleMinutesPerDay > 0 ? ratePerDay / scheduleMinutesPerDay : 0;

  const regularMinutes = Math.min(workMinutes, input.scheduleMinutesTotal);
  const undertimeMinutes = Math.max(input.scheduleMinutesTotal - regularMinutes, 0);

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

    const deductions = await loadRunDeductions(supabase, input.runId, item.employee_id);
    const preview = computePayslipPreview({
      run,
      item,
      employee,
      policy,
      scheduleMinutesTotal: schedule.totalMinutes,
      scheduleDayCount: schedule.dayCount,
      missingScheduleDays: schedule.missingScheduleDays,
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

  const { employeeName: _employeeName, employeeCode: _employeeCode, ...preview } = rows[0];
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

  if (run.status === "finalized") {
    throw new PayrollRunDeductionFinalizedError("Payroll run is finalized and cannot accept deductions.");
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
