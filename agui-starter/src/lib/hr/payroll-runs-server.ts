import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  HrPayrollRunItemInsert,
  HrPayrollRunItemRow,
  HrPayrollRunRow,
} from "@/lib/db.types";
import { requireHrAccess, type HrAccessDecision } from "./access";
import {
  computePayrollPreviewForHousePeriod,
  type PayrollPreviewResult,
} from "./payroll-preview-server";
import { parseDateParts } from "./overtime-engine";

export type PayrollRunStatus = HrPayrollRunRow["status"];

export type PayrollRunListItem = {
  id: string;
  houseId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollRunStatus;
  createdBy: string | null;
  createdAt: string;
  finalizedAt: string | null;
  finalizedBy: string | null;
  finalizeNote: string | null;
  itemCount: number;
};

export type PayrollRunItemSnapshot = {
  id: string;
  runId: string;
  houseId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  workMinutes: number;
  overtimeMinutesRaw: number;
  overtimeMinutesRounded: number;
  missingScheduleDays: number;
  openSegmentDays: number;
  correctedSegmentDays: number;
  notes: Record<string, unknown>;
  createdAt: string;
};

export type PayrollRunDetails = {
  run: PayrollRunListItem;
  items: PayrollRunItemSnapshot[];
};

export class PayrollRunAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunAccessError";
  }
}

export class PayrollRunValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunValidationError";
  }
}

export class PayrollRunMutationError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "PayrollRunMutationError";
    this.code = code;
  }
}

export class PayrollRunFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunFetchError";
  }
}

export class PayrollRunFinalizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunFinalizedError";
  }
}

export class PayrollRunNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollRunNotFoundError";
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

async function resolveAccess(
  supabase: SupabaseClient<Database>,
  houseId: string,
  accessOverride?: HrAccessDecision,
): Promise<HrAccessDecision> {
  if (accessOverride) return accessOverride;
  return requireHrAccess(supabase, houseId);
}

function mapRun(row: HrPayrollRunRow, itemCount: number): PayrollRunListItem {
  return {
    id: row.id,
    houseId: row.house_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    finalizedAt: row.finalized_at ?? null,
    finalizedBy: row.finalized_by ?? null,
    finalizeNote: row.finalize_note ?? null,
    itemCount,
  } satisfies PayrollRunListItem;
}

function mapItem(row: HrPayrollRunItemRow, employeeLookup: Map<string, { name: string; code: string }>) {
  const employee = employeeLookup.get(row.employee_id);
  return {
    id: row.id,
    runId: row.run_id,
    houseId: row.house_id,
    employeeId: row.employee_id,
    employeeName: employee?.name ?? "Unknown",
    employeeCode: employee?.code ?? "",
    workMinutes: row.work_minutes,
    overtimeMinutesRaw: row.overtime_minutes_raw,
    overtimeMinutesRounded: row.overtime_minutes_rounded,
    missingScheduleDays: row.missing_schedule_days,
    openSegmentDays: row.open_segment_days,
    correctedSegmentDays: row.corrected_segment_days,
    notes: (row.notes as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  } satisfies PayrollRunItemSnapshot;
}

export async function listPayrollRunsForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  options: { access?: HrAccessDecision } = {},
): Promise<PayrollRunListItem[]> {
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) {
    throw new PayrollRunAccessError("Not allowed to access payroll runs for this house.");
  }

  const { data, error } = await supabase
    .from("hr_payroll_runs")
    .select(
      "id, house_id, period_start, period_end, status, created_by, created_at, finalized_at, finalized_by, finalize_note",
    )
    .eq("house_id", houseId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new PayrollRunFetchError(error.message);
  }

  const rows = (data as HrPayrollRunRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const runIds = rows.map((row) => row.id);
  const { data: itemRows, error: itemError } = await supabase
    .from("hr_payroll_run_items")
    .select("run_id")
    .in("run_id", runIds);

  if (itemError) {
    throw new PayrollRunFetchError(itemError.message);
  }

  const counts = new Map<string, number>();
  (itemRows ?? []).forEach((row) => {
    const runId = (row as { run_id?: string | null }).run_id;
    if (!runId) return;
    counts.set(runId, (counts.get(runId) ?? 0) + 1);
  });

  return rows.map((row) => mapRun(row, counts.get(row.id) ?? 0));
}

export async function getPayrollRunWithItems(
  supabase: SupabaseClient<Database>,
  houseId: string,
  runId: string,
  options: { access?: HrAccessDecision } = {},
): Promise<PayrollRunDetails | null> {
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) {
    throw new PayrollRunAccessError("Not allowed to access payroll runs for this house.");
  }

  const { data, error } = await supabase
    .from("hr_payroll_runs")
    .select(
      "id, house_id, period_start, period_end, status, created_by, created_at, finalized_at, finalized_by, finalize_note",
    )
    .eq("id", runId)
    .maybeSingle<HrPayrollRunRow>();

  if (error) {
    throw new PayrollRunFetchError(error.message);
  }

  if (!data) return null;

  if (data.house_id !== houseId) {
    throw new PayrollRunAccessError("Payroll run does not belong to this house.");
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from("hr_payroll_run_items")
    .select(
      "id, run_id, house_id, employee_id, work_minutes, overtime_minutes_raw, overtime_minutes_rounded, missing_schedule_days, open_segment_days, corrected_segment_days, notes, created_at",
    )
    .eq("run_id", runId)
    .order("employee_id", { ascending: true });

  if (itemsError) {
    throw new PayrollRunFetchError(itemsError.message);
  }

  const items = (itemsData as HrPayrollRunItemRow[] | null) ?? [];
  const employeeIds = Array.from(new Set(items.map((item) => item.employee_id)));

  const employeeLookup = new Map<string, { name: string; code: string }>();
  if (employeeIds.length > 0) {
    const { data: employeesData, error: employeeError } = await supabase
      .from("employees")
      .select("id, code, full_name, house_id")
      .eq("house_id", houseId)
      .in("id", employeeIds);

    if (employeeError) {
      throw new PayrollRunFetchError(employeeError.message);
    }

    (employeesData ?? []).forEach((row) => {
      const employee = row as { id?: string | null; code?: string | null; full_name?: string | null };
      if (!employee.id) return;
      employeeLookup.set(employee.id, {
        name: employee.full_name ?? "Unknown",
        code: employee.code ?? "",
      });
    });
  }

  const run = mapRun(data, items.length);
  const mappedItems = items.map((item) => mapItem(item, employeeLookup));

  return { run, items: mappedItems } satisfies PayrollRunDetails;
}

export type PayrollRunCreateInput = {
  houseId: string;
  periodStart: string;
  periodEnd: string;
  createdBy?: string | null;
};

export async function finalizePayrollRunForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  runId: string,
  options: { access?: HrAccessDecision } = {},
): Promise<{ run: PayrollRunListItem; itemsCount: number }> {
  const access = await resolveAccess(supabase, houseId, options.access);
  if (!access.allowed) {
    throw new PayrollRunAccessError("Not allowed to finalize payroll runs for this house.");
  }

  const { data: run, error: runError } = await supabase
    .from("hr_payroll_runs")
    .select(
      "id, house_id, period_start, period_end, status, created_by, created_at, finalized_at, finalized_by, finalize_note",
    )
    .eq("id", runId)
    .maybeSingle<HrPayrollRunRow>();

  if (runError) {
    throw new PayrollRunFetchError(runError.message);
  }

  if (!run || run.house_id !== houseId) {
    throw new PayrollRunNotFoundError("Payroll run not found.");
  }

  if (run.status === "finalized") {
    throw new PayrollRunFinalizedError("Payroll run already finalized.");
  }

  const { data: updatedRun, error: updateError } = await supabase
    .from("hr_payroll_runs")
    .update({
      status: "finalized",
      finalized_at: new Date().toISOString(),
      finalized_by: access.entityId,
    })
    .eq("id", runId)
    .select(
      "id, house_id, period_start, period_end, status, created_by, created_at, finalized_at, finalized_by, finalize_note",
    )
    .maybeSingle<HrPayrollRunRow>();

  if (updateError) {
    throw new PayrollRunMutationError(updateError.message, updateError.code);
  }

  if (!updatedRun) {
    throw new PayrollRunMutationError("Failed to finalize payroll run.");
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from("hr_payroll_run_items")
    .select("id")
    .eq("run_id", runId);

  if (itemsError) {
    throw new PayrollRunFetchError(itemsError.message);
  }

  const itemsCount = (itemsData as { id?: string | null }[] | null)?.length ?? 0;

  return { run: mapRun(updatedRun, itemsCount), itemsCount };
}

export async function createDraftPayrollRunFromPreview(
  supabase: SupabaseClient<Database>,
  input: PayrollRunCreateInput,
  options: { access?: HrAccessDecision; previewOverride?: PayrollPreviewResult } = {},
): Promise<{ runId: string }> {
  const access = await resolveAccess(supabase, input.houseId, options.access);
  if (!access.allowed) {
    throw new PayrollRunAccessError("Not allowed to create payroll runs for this house.");
  }

  if (!parseDateParts(input.periodStart) || !parseDateParts(input.periodEnd)) {
    throw new PayrollRunValidationError("Invalid period start/end format.");
  }

  if (compareDateStrings(input.periodStart, input.periodEnd) > 0) {
    throw new PayrollRunValidationError("periodStart must be on or before periodEnd.");
  }

  const preview =
    options.previewOverride ??
    (await computePayrollPreviewForHousePeriod(
      supabase,
      {
        houseId: input.houseId,
        startDate: input.periodStart,
        endDate: input.periodEnd,
      },
      { access },
    ));

  const { data: run, error: runError } = await supabase
    .from("hr_payroll_runs")
    .insert({
      house_id: input.houseId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: "draft",
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, house_id, period_start, period_end, status, created_by, created_at, finalized_at, finalized_by, finalize_note",
    )
    .maybeSingle<HrPayrollRunRow>();

  if (runError) {
    throw new PayrollRunMutationError(runError.message, runError.code);
  }

  if (!run) {
    throw new PayrollRunMutationError("Failed to create payroll run.");
  }

  const items: HrPayrollRunItemInsert[] = preview.rows.map((row) => ({
    run_id: run.id,
    house_id: input.houseId,
    employee_id: row.employeeId,
    work_minutes: row.workMinutesTotal,
    overtime_minutes_raw: row.derivedOtMinutesRawTotal,
    overtime_minutes_rounded: row.derivedOtMinutesRoundedTotal,
    missing_schedule_days: row.flags.missingScheduleDays,
    open_segment_days: row.flags.openSegmentDays,
    corrected_segment_days: row.flags.hasCorrectedSegments ? 1 : 0,
    notes: row.flags.hasCorrectedSegments ? { hasCorrectedSegments: true } : {},
  }));

  if (items.length > 0) {
    const { error: itemError } = await supabase.from("hr_payroll_run_items").insert(items);
    if (itemError) {
      throw new PayrollRunMutationError(itemError.message, itemError.code);
    }
  }

  return { runId: run.id };
}
