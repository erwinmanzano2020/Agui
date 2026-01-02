import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, DtrSegmentRow, EmployeeRow } from "@/lib/db.types";

const DTR_SEGMENT_COLUMNS =
  "id, house_id, employee_id, work_date, time_in, time_out, hours_worked, overtime_minutes, source, status, created_at";

type DateRange = { start: string; end: string };
type MinimalEmployee = Pick<EmployeeRow, "id" | "house_id" | "branch_id">;

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
): Promise<DtrSegmentRow[]> {
  const { data, error } = await supabase
    .from("dtr_segments")
    .select(DTR_SEGMENT_COLUMNS)
    .eq("house_id", houseId)
    .eq("work_date", workDate)
    .order("time_in", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeSegments(data as DtrSegmentRow[]);
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
