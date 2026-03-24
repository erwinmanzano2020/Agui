import { jsonError, jsonOk } from "@/lib/api/http";

export const PAYROLL_WRITE_VALIDATION_MESSAGE = "Fix the highlighted fields and try again.";
export const PAYROLL_WRITE_AUTH_REQUIRED_MESSAGE = "Authentication required.";
export const PAYROLL_WRITE_FORBIDDEN_MESSAGE = "You are not allowed to perform this action.";
export const PAYROLL_WRITE_NOT_FOUND_MESSAGE = "Record not found.";
export const PAYROLL_WRITE_UNEXPECTED_MESSAGE = "Unable to process request right now.";

export function payrollWriteValidation(detail?: string, fallback = "Missing or invalid parameters.") {
  return jsonError(400, PAYROLL_WRITE_VALIDATION_MESSAGE, { message: detail ?? fallback });
}

export function payrollWriteAuthRequired() {
  return jsonError(401, PAYROLL_WRITE_AUTH_REQUIRED_MESSAGE);
}

export function payrollWriteForbidden(detail?: string) {
  return detail
    ? jsonError(403, PAYROLL_WRITE_FORBIDDEN_MESSAGE, { message: detail })
    : jsonError(403, PAYROLL_WRITE_FORBIDDEN_MESSAGE);
}

export function payrollWriteNotFound(detail = "Payroll run not found.") {
  return jsonError(404, PAYROLL_WRITE_NOT_FOUND_MESSAGE, { message: detail });
}

export function payrollWriteUnexpected(detail?: string) {
  return detail
    ? jsonError(500, PAYROLL_WRITE_UNEXPECTED_MESSAGE, { message: detail })
    : jsonError(500, PAYROLL_WRITE_UNEXPECTED_MESSAGE);
}

export function payrollWriteSuccess<T extends Record<string, unknown>>(payload: T, message: string) {
  return jsonOk({ ...payload, message });
}
