import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/db.types";
import type { HrBranchAccessDecision } from "@/lib/hr/access";

export type CanonicalAttendanceRow = {
  fact_id: string;
  employee_id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  hours_worked: number | null;
  overtime_minutes: number;
  status: string;
  attribution_state: "ATTRIBUTED" | "UNATTRIBUTED" | "CONFLICT";
  active_branch_id: string | null;
};

export type AttendanceCorrectionProposalInput = {
  houseId: string;
  factId: string;
  operationId: string;
  workDate: string;
  timeIn: string;
  timeOut: string | null;
  targetBranchId: string | null;
  reason: string;
};

export type AttendanceRemediationOpenInput = {
  houseId: string;
  employeeId: string;
  operationId: string;
  workDate: string;
  timeIn: string;
  timeOut: string | null;
  assertedBranchId: string;
  reason: string;
};

export type AttendanceRemediationCandidate = {
  identity: string;
  kind: "FACT" | "EVIDENCE" | "OBSERVATION";
  factId?: string;
  evidenceId?: string;
  observationId?: string | null;
  workDate?: string;
  timeIn?: string | null;
  timeOut?: string | null;
  attributionState?: string | null;
  activeBranchId?: string | null;
  branchId?: string | null;
  occurredAt?: string | null;
  integrityState?: string | null;
};

export type P1RpcResult = {
  status?: string;
  caseId?: string;
  factId?: string;
  correctionKind?: string;
  payrollImpact?: string;
  route?: string;
  coverageComplete?: boolean;
  candidates?: AttendanceRemediationCandidate[];
  selectedCandidate?: AttendanceRemediationCandidate | null;
  replayed?: boolean;
};

function normalizeRpcResult(data: Json | null): P1RpcResult {
  if (!data || Array.isArray(data) || typeof data !== "object") {
    return {};
  }
  return data as unknown as P1RpcResult;
}

export async function listCanonicalAttendanceForDate(
  supabase: SupabaseClient<Database>,
  houseId: string,
  workDate: string,
  access: HrBranchAccessDecision,
  employeeId?: string,
): Promise<CanonicalAttendanceRow[]> {
  if (!access.allowed) return [];

  const functionName = access.isBranchLimited
    ? "hr_read_canonical_attendance_branch_scoped"
    : "hr_read_canonical_attendance_house_global";

  const { data, error } = await supabase.rpc(functionName, {
    p_house_id: houseId,
    p_start_date: workDate,
    p_end_date: workDate,
    p_employee_id: employeeId ?? null,
    p_limit: 200,
    p_offset: 0,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    fact_id: String(row.fact_id),
    employee_id: String(row.employee_id),
    work_date: String(row.work_date),
    time_in: typeof row.time_in === "string" ? row.time_in : null,
    time_out: typeof row.time_out === "string" ? row.time_out : null,
    hours_worked:
      typeof row.hours_worked === "number"
        ? row.hours_worked
        : row.hours_worked == null
          ? null
          : Number(row.hours_worked),
    overtime_minutes: Number(row.overtime_minutes ?? 0),
    status: String(row.status ?? ""),
    attribution_state:
      row.attribution_state === "UNATTRIBUTED" || row.attribution_state === "CONFLICT"
        ? row.attribution_state
        : "ATTRIBUTED",
    active_branch_id:
      typeof row.active_branch_id === "string" ? row.active_branch_id : null,
  }));
}

export async function proposeAttendanceCorrection(
  supabase: SupabaseClient<Database>,
  input: AttendanceCorrectionProposalInput,
): Promise<P1RpcResult> {
  const { data, error } = await supabase.rpc("hr_propose_attendance_correction", {
    p_house_id: input.houseId,
    p_fact_id: input.factId,
    p_operation_id: input.operationId,
    p_work_date: input.workDate,
    p_time_in: input.timeIn,
    p_time_out: input.timeOut,
    p_target_branch_id: input.targetBranchId,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return normalizeRpcResult(data);
}

export async function finalizeAttendanceCorrection(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; caseId: string; operationId: string },
): Promise<P1RpcResult> {
  const { data, error } = await supabase.rpc("hr_finalize_attendance_correction", {
    p_house_id: input.houseId,
    p_correction_case_id: input.caseId,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error(error.message);
  return normalizeRpcResult(data);
}

export async function openAttendanceRemediationCase(
  supabase: SupabaseClient<Database>,
  input: AttendanceRemediationOpenInput,
): Promise<P1RpcResult> {
  const { data, error } = await supabase.rpc("hr_open_attendance_remediation_case", {
    p_house_id: input.houseId,
    p_employee_id: input.employeeId,
    p_operation_id: input.operationId,
    p_work_date: input.workDate,
    p_time_in: input.timeIn,
    p_time_out: input.timeOut,
    p_asserted_branch_id: input.assertedBranchId,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return normalizeRpcResult(data);
}

export async function adjudicateAttendanceRemediationCase(
  supabase: SupabaseClient<Database>,
  input: {
    houseId: string;
    caseId: string;
    operationId: string;
    decision: "EXISTING_RELATED" | "DISTINCT_NEW";
    selectedCandidateIdentity: string | null;
  },
): Promise<P1RpcResult> {
  const { data, error } = await supabase.rpc("hr_adjudicate_attendance_remediation_case", {
    p_house_id: input.houseId,
    p_remediation_case_id: input.caseId,
    p_operation_id: input.operationId,
    p_decision: input.decision,
    p_selected_candidate_identity: input.selectedCandidateIdentity,
  });
  if (error) throw new Error(error.message);
  return normalizeRpcResult(data);
}

export async function finalizeAttendanceRemediationCase(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; caseId: string; operationId: string },
): Promise<P1RpcResult> {
  const { data, error } = await supabase.rpc("hr_finalize_attendance_remediation_case", {
    p_house_id: input.houseId,
    p_remediation_case_id: input.caseId,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error(error.message);
  return normalizeRpcResult(data);
}
