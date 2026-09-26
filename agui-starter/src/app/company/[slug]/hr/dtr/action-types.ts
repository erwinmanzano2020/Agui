import type { AttendanceRemediationCandidate } from "@/lib/hr/attendance-p1-server";

export type DtrMutationState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
  caseId?: string;
  resultStatus?: string;
  route?: string;
  coverageComplete?: boolean;
  candidates?: AttendanceRemediationCandidate[];
};

export const dtrMutationInitialState: DtrMutationState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
