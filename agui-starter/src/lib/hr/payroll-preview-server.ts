import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EmployeeRow } from "@/lib/db.types";
import { requireHrAccessWithBranch, type HrAccessDecision, type HrBranchAccessDecision } from "./access";
import { listCanonicalAttendanceForRange, type CanonicalAttendanceRow } from "./attendance-p1-server";
import { computeOvertimeForHouseDate, getScheduleForEmployeeOnDate, parseDateParts } from "./overtime-engine";
import { computeDailyRateBreakdown } from "./payroll-math";
import { isWorkDateMismatch, toManilaDate } from "./timezone";

export type PayrollPreviewInput = {
  houseId: string;
  startDate: string;
  endDate: string;
  branchId?: string | null;
  employeeId?: string | null;
};

export type PayrollPreviewRow = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string | null;
  workMinutesTotal: number;
  derivedOtMinutesRawTotal: number;
  derivedOtMinutesRoundedTotal: number;
  flags: {
    missingScheduleDays: number;
    openSegmentDays: number;
    hasCorrectedSegments: boolean;
    timezoneMismatchDays: number;
  };
};

export type PayrollPreviewSummary = {
  employeeCount: number;
  totalWorkMinutes: number;
  totalDerivedOtMinutesRaw: number;
  totalDerivedOtMinutesRounded: number;
  openSegmentCount: number;
  missingScheduleCount: number;
};

export type PayrollPreviewResult = {
  period: { startDate: string; endDate: string };
  rows: PayrollPreviewRow[];
  summary: PayrollPreviewSummary;
};

export class PayrollPreviewAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollPreviewAccessError";
  }
}

export class PayrollPreviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollPreviewValidationError";
  }
}

function compareDateStrings(a: string, b: string): number {
  const aParts = parseDateParts(a);
  const bParts = parseDateParts(b);
  if (!aParts || !bParts) return 0;
  const aUtc = Date.UTC(aParts.year, aParts.month - 1, aParts.day);
  const bUtc = Date.UTC(bParts.year, bParts.month - 1, bParts.day);
  return aUtc - bUtc;
}

function buildEmptySummary(): PayrollPreviewSummary {
  return {
    employeeCount: 0,
    totalWorkMinutes: 0,
    totalDerivedOtMinutesRaw: 0,
    totalDerivedOtMinutesRounded: 0,
    openSegmentCount: 0,
    missingScheduleCount: 0,
  };
}

async function resolveAccess(
  supabase: SupabaseClient<Database>,
  houseId: string,
  accessOverride?: HrAccessDecision,
): Promise<HrBranchAccessDecision> {
  if (
    accessOverride &&
    "isBranchLimited" in accessOverride &&
    "allowedBranchIds" in accessOverride
  ) {
    return accessOverride as HrBranchAccessDecision;
  }

  if (accessOverride?.allowedByRole) {
    return {
      ...accessOverride,
      branchId: null,
      isBranchLimited: false,
      allowedBranchIds: [],
    };
  }

  return requireHrAccessWithBranch(supabase, {
    houseId,
    requiredLevel: "read",
    requiredCapability: "payroll",
  });
}

async function loadBranchForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  branchId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("branches")
    .select("id, house_id")
    .eq("id", branchId)
    .maybeSingle<{ id: string; house_id: string | null }>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return data.house_id === houseId ? data.id : null;
}

async function loadEmployeesForIds(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeIds: string[],
): Promise<EmployeeRow[]> {
  if (employeeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("employees")
    .select("id, house_id, code, full_name, branch_id")
    .eq("house_id", houseId)
    .in("id", employeeIds)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as EmployeeRow[] | null) ?? [];
}

export async function computePayrollPreviewForHousePeriod(
  supabase: SupabaseClient<Database>,
  input: PayrollPreviewInput,
  options: { access?: HrAccessDecision } = {},
): Promise<PayrollPreviewResult> {
  const access = await resolveAccess(supabase, input.houseId, options.access);
  if (!access.allowed) {
    throw new PayrollPreviewAccessError("Not allowed to access payroll preview for this house.");
  }

  if (!parseDateParts(input.startDate) || !parseDateParts(input.endDate)) {
    throw new PayrollPreviewValidationError("Invalid startDate/endDate format.");
  }

  if (compareDateStrings(input.startDate, input.endDate) > 0) {
    throw new PayrollPreviewValidationError("startDate must be on or before endDate.");
  }

  if (input.branchId) {
    const branchId = await loadBranchForHouse(supabase, input.houseId, input.branchId);
    if (!branchId) {
      throw new PayrollPreviewAccessError("Branch does not belong to this house.");
    }
  }

  const canonicalFacts = await listCanonicalAttendanceForRange(
    supabase,
    input.houseId,
    input.startDate,
    input.endDate,
    access,
    input.employeeId ?? undefined,
  );

  const visibleFacts = input.branchId
    ? canonicalFacts.filter((fact) => fact.active_branch_id === input.branchId)
    : canonicalFacts;

  if (visibleFacts.length === 0) {
    return {
      period: { startDate: input.startDate, endDate: input.endDate },
      rows: [],
      summary: buildEmptySummary(),
    } satisfies PayrollPreviewResult;
  }

  const visibleEmployeeIds = Array.from(
    new Set(visibleFacts.map((fact) => fact.employee_id)),
  );
  const employees = await loadEmployeesForIds(
    supabase,
    input.houseId,
    visibleEmployeeIds,
  );
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const segments = visibleFacts;

  if (segments.length === 0) {
    return {
      period: { startDate: input.startDate, endDate: input.endDate },
      rows: [],
      summary: buildEmptySummary(),
    } satisfies PayrollPreviewResult;
  }

  const rowsByEmployee = new Map<string, PayrollPreviewRow>();
  const segmentsByEmployeeDate = new Map<string, Map<string, CanonicalAttendanceRow[]>>();
  const openSegmentDays = new Map<string, Set<string>>();
  const timezoneMismatchDays = new Map<string, Set<string>>();

  segments.forEach((segment) => {
    const employee = employeeMap.get(segment.employee_id);
    if (!employee || !segment.work_date) return;
    if (isWorkDateMismatch(segment.work_date, segment.time_in, segment.time_out)) {
      const mismatchSet = timezoneMismatchDays.get(employee.id) ?? new Set<string>();
      mismatchSet.add(segment.work_date);
      timezoneMismatchDays.set(employee.id, mismatchSet);
    }
  });

  segments.forEach((segment) => {
    const employee = employeeMap.get(segment.employee_id);
    if (!employee) return;

    if (!rowsByEmployee.has(employee.id)) {
      rowsByEmployee.set(employee.id, {
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: employee.full_name,
        branchId: employee.branch_id ?? null,
        workMinutesTotal: 0,
        derivedOtMinutesRawTotal: 0,
        derivedOtMinutesRoundedTotal: 0,
        flags: {
          missingScheduleDays: 0,
          openSegmentDays: 0,
          hasCorrectedSegments: false,
          timezoneMismatchDays: 0,
        },
      });
    }

    const row = rowsByEmployee.get(employee.id);
    if (!row) return;

    if (segment.status === "corrected") {
      row.flags.hasCorrectedSegments = true;
    }

    const manilaWorkDate = toManilaDate(segment.time_in) ?? segment.work_date;

    if (!segment.time_out) {
      const daySet = openSegmentDays.get(employee.id) ?? new Set<string>();
      daySet.add(manilaWorkDate);
      openSegmentDays.set(employee.id, daySet);
    }

    const dateMap = segmentsByEmployeeDate.get(employee.id) ?? new Map<string, DtrSegmentRow[]>();
    const bucket = dateMap.get(manilaWorkDate) ?? [];
    bucket.push(segment);
    dateMap.set(manilaWorkDate, bucket);
    segmentsByEmployeeDate.set(employee.id, dateMap);
  });

  const uniqueDates = new Set<string>();
  segmentsByEmployeeDate.forEach((dateMap) => {
    dateMap.forEach((_segments, date) => {
      uniqueDates.add(date);
    });
  });

  const dates = Array.from(uniqueDates).sort((a, b) => compareDateStrings(a, b));
  for (const date of dates) {
    const employeesForDate = Array.from(segmentsByEmployeeDate.entries())
      .filter(([, dateMap]) => dateMap.has(date))
      .map(([employeeId]) => employeeId);

    if (employeesForDate.length === 0) continue;

    const overtimeResults = await computeOvertimeForHouseDate(supabase, {
      houseId: input.houseId,
      workDate: date,
      employeeIds: employeesForDate,
    }, { access });

    overtimeResults.forEach((result) => {
      const row = rowsByEmployee.get(result.employeeId);
      if (!row) return;
      if (!segmentsByEmployeeDate.get(result.employeeId)?.has(date)) return;

      row.derivedOtMinutesRawTotal += result.rawOtMinutes;
      row.derivedOtMinutesRoundedTotal += result.finalOtMinutes;
      if (result.scheduleStatus === "no_schedule") {
        row.flags.missingScheduleDays += 1;
      }
    });
  }

  for (const [employeeId, dateMap] of segmentsByEmployeeDate.entries()) {
    const row = rowsByEmployee.get(employeeId);
    if (!row) continue;
    for (const [date, segmentsForDate] of dateMap.entries()) {
      const schedule = await getScheduleForEmployeeOnDate(
        supabase,
        { houseId: input.houseId, employeeId, workDate: date },
        { access },
      );
      const breakdown = computeDailyRateBreakdown(
        segmentsForDate,
        schedule.status === "ok"
          ? {
              scheduledStartTs: schedule.scheduledStartTs,
              scheduledEndTs: schedule.scheduledEndTs,
              breakStartTs: schedule.breakStartTs ?? null,
              breakEndTs: schedule.breakEndTs ?? null,
            }
          : null,
      );
      row.workMinutesTotal += breakdown.regularMinutes;
    }
  }

  rowsByEmployee.forEach((row, employeeId) => {
    const openDays = openSegmentDays.get(employeeId);
    if (openDays) {
      row.flags.openSegmentDays = openDays.size;
    }
    const mismatchDays = timezoneMismatchDays.get(employeeId);
    if (mismatchDays) {
      row.flags.timezoneMismatchDays = mismatchDays.size;
    }
  });

  const rows = Array.from(rowsByEmployee.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );

  const summary = rows.reduce<PayrollPreviewSummary>(
    (acc, row) => {
      acc.employeeCount += 1;
      acc.totalWorkMinutes += row.workMinutesTotal;
      acc.totalDerivedOtMinutesRaw += row.derivedOtMinutesRawTotal;
      acc.totalDerivedOtMinutesRounded += row.derivedOtMinutesRoundedTotal;
      acc.openSegmentCount += row.flags.openSegmentDays;
      acc.missingScheduleCount += row.flags.missingScheduleDays;
      return acc;
    },
    buildEmptySummary(),
  );

  return {
    period: { startDate: input.startDate, endDate: input.endDate },
    rows,
    summary,
  } satisfies PayrollPreviewResult;
}
