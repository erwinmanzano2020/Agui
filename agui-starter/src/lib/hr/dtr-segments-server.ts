import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, DtrSegmentRow, EmployeeRow } from "@/lib/db.types";

const DTR_SEGMENT_COLUMNS =
  "id, house_id, employee_id, work_date, time_in, time_out, hours_worked, overtime_minutes, source, status, created_at";

type DateRange = { start: string; end: string };
type MinimalEmployee = Pick<EmployeeRow, "id" | "house_id" | "branch_id">;

export class DtrSegmentAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DtrSegmentAccessError";
  }
}

function isPermissionDenied(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: string }).message ?? "")
      : error instanceof Error
        ? error.message
        : "";
  return /permission denied/i.test(message) || /42501/.test(message);
}

function normalizeSegments(rows: DtrSegmentRow[] | null | undefined): DtrSegmentRow[] {
  return (rows ?? []).map((row) => ({
    ...row,
    hours_worked: row.hours_worked === null ? null : Number(row.hours_worked),
    overtime_minutes: Number(row.overtime_minutes ?? 0),
  }));
}

async function loadEmployeeForAccess(
  supabase: SupabaseClient<Database>,
  employeeId: string,
): Promise<MinimalEmployee | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, house_id, branch_id")
    .eq("id", employeeId)
    .maybeSingle<MinimalEmployee>();

  if (error) {
    if (isPermissionDenied(error)) return null;
    throw new Error(error.message);
  }

  if (!data) return null;
  if (!data.house_id) return null;

  return data;
}

export async function listDtrByHouseAndDate(
  supabase: SupabaseClient<Database>,
  houseId: string,
  workDate: string,
  options: { employeeId?: string } = {},
): Promise<DtrSegmentRow[]> {
  let query = supabase
    .from("dtr_segments")
    .select(DTR_SEGMENT_COLUMNS)
    .eq("house_id", houseId)
    .eq("work_date", workDate);

  if (options.employeeId) {
    query = query.eq("employee_id", options.employeeId);
  }

  const { data, error } = await query.order("time_in", { ascending: true });

  if (error) {
    if (isPermissionDenied(error)) return [];
    throw new Error(error.message);
  }

  return normalizeSegments(data as DtrSegmentRow[]);
}

export async function createDtrSegment(
  supabase: SupabaseClient<Database>,
  input: {
    houseId: string;
    employeeId: string;
    workDate: string;
    timeIn: string;
    timeOut: string | null;
  },
): Promise<DtrSegmentRow> {
  const employee = await loadEmployeeForAccess(supabase, input.employeeId);
  if (!employee) {
    throw new DtrSegmentAccessError("Employee is not available for DTR entry.");
  }

  if (employee.house_id !== input.houseId) {
    throw new DtrSegmentAccessError("Employee does not belong to this house.");
  }

  const payload = {
    house_id: input.houseId,
    employee_id: input.employeeId,
    work_date: input.workDate,
    time_in: input.timeIn,
    time_out: input.timeOut,
    hours_worked: null,
    overtime_minutes: 0,
    source: "manual",
    status: input.timeOut ? "closed" : "open",
  } satisfies Partial<DtrSegmentRow>;

  const { data, error } = await supabase
    .from("dtr_segments")
    .insert(payload)
    .select(DTR_SEGMENT_COLUMNS)
    .maybeSingle<DtrSegmentRow>();

  if (error) {
    if (isPermissionDenied(error)) {
      throw new DtrSegmentAccessError("Not allowed to create DTR segments for this house.");
    }
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Failed to create DTR segment.");
  }

  return normalizeSegments([data])[0];
}

export async function listDtrByEmployee(
  supabase: SupabaseClient<Database>,
  employeeId: string,
  dateRange: DateRange,
): Promise<DtrSegmentRow[]> {
  const employee = await loadEmployeeForAccess(supabase, employeeId);
  if (!employee) return [];

  const { data, error } = await supabase
    .from("dtr_segments")
    .select(DTR_SEGMENT_COLUMNS)
    .eq("house_id", employee.house_id)
    .eq("employee_id", employee.id)
    .gte("work_date", dateRange.start)
    .lte("work_date", dateRange.end)
    .order("work_date", { ascending: true })
    .order("time_in", { ascending: true });

  if (error) {
    if (isPermissionDenied(error)) return [];
    throw new Error(error.message);
  }

  return normalizeSegments(data as DtrSegmentRow[]);
}

export async function listDtrTodayByBranch(
  supabase: SupabaseClient<Database>,
  branchId: string,
  options: { today?: string } = {},
): Promise<DtrSegmentRow[]> {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("id, house_id, branch_id")
    .eq("branch_id", branchId);

  if (employeesError) {
    if (isPermissionDenied(employeesError)) return [];
    throw new Error(employeesError.message);
  }

  const accessibleEmployees = (employees as MinimalEmployee[] | null) ?? [];
  const houseId = accessibleEmployees[0]?.house_id ?? null;
  if (!houseId) return [];

  const employeeIds = accessibleEmployees
    .filter((emp) => emp.house_id === houseId)
    .map((emp) => emp.id);

  if (employeeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("dtr_segments")
    .select(DTR_SEGMENT_COLUMNS)
    .eq("house_id", houseId)
    .in("employee_id", employeeIds)
    .eq("work_date", today)
    .order("time_in", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeSegments(data as DtrSegmentRow[]);
}
