import type { HrBranchAccessDecision } from "@/lib/hr/access";
import type { CanonicalAttendanceRow } from "@/lib/hr/attendance-p1-server";
import type { EmployeeListItem } from "@/lib/hr/employees-server";

export function canonicalEmployeeIds(rows: CanonicalAttendanceRow[]): string[] {
  return Array.from(new Set(rows.map((row) => row.employee_id)));
}

export function groupCanonicalAttendance(
  rows: CanonicalAttendanceRow[],
): Map<string, CanonicalAttendanceRow[]> {
  const grouped = new Map<string, CanonicalAttendanceRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.employee_id) ?? [];
    bucket.push(row);
    grouped.set(row.employee_id, bucket);
  }
  return grouped;
}

export function applyCanonicalEmployeeFilter(
  rows: CanonicalAttendanceRow[],
  requestedEmployeeId: string,
): { rows: CanonicalAttendanceRow[]; selectedEmployeeId: string } {
  const requested = requestedEmployeeId.trim();
  if (!requested) {
    return { rows, selectedEmployeeId: "" };
  }

  const visibleIds = new Set(rows.map((row) => row.employee_id));
  if (!visibleIds.has(requested)) {
    // Ignore arbitrary/hidden/non-visible identifiers instead of creating a
    // different attendance-existence response.
    return { rows, selectedEmployeeId: "" };
  }

  return {
    rows: rows.filter((row) => row.employee_id === requested),
    selectedEmployeeId: requested,
  };
}

export function canCorrectCanonicalFact(
  fact: CanonicalAttendanceRow,
  writeAccess: HrBranchAccessDecision,
): boolean {
  if (!writeAccess.allowed) return false;
  if (!writeAccess.isBranchLimited) return true;
  if (fact.attribution_state !== "ATTRIBUTED" || !fact.active_branch_id) return false;

  const allowed = new Set(writeAccess.allowedBranchIds.map((id) => id.toLowerCase()));
  return allowed.has(fact.active_branch_id.toLowerCase());
}

export function canCaptureCurrentEmployee(
  employee: EmployeeListItem,
  writeAccess: HrBranchAccessDecision,
): boolean {
  if (!writeAccess.allowed) return false;
  if (!writeAccess.isBranchLimited) return true;
  if (!employee.branch_id) return false;

  const allowed = new Set(writeAccess.allowedBranchIds.map((id) => id.toLowerCase()));
  return allowed.has(employee.branch_id.toLowerCase());
}
