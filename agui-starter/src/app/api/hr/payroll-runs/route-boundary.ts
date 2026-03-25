import { jsonError, jsonOk } from "@/lib/api/http";

/**
 * Canonical payroll-run route response envelopes used by both read and write handlers.
 * Route-specific domain branches (for example 409 status transitions) stay local to each route.
 */
export const PAYROLL_ROUTE_VALIDATION_MESSAGE = "Fix the highlighted fields and try again.";
export const PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE = "Authentication required.";
export const PAYROLL_ROUTE_FORBIDDEN_MESSAGE = "You are not allowed to perform this action.";
export const PAYROLL_ROUTE_NOT_FOUND_MESSAGE = "Record not found.";
export const PAYROLL_ROUTE_UNEXPECTED_MESSAGE = "Unable to process request right now.";

export function payrollRouteValidation(detail?: string, fallback = "Missing or invalid parameters.") {
  return jsonError(400, PAYROLL_ROUTE_VALIDATION_MESSAGE, { message: detail ?? fallback });
}

export function payrollRouteAuthRequired() {
  return jsonError(401, PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE);
}

export function payrollRouteForbidden(detail?: string) {
  return detail
    ? jsonError(403, PAYROLL_ROUTE_FORBIDDEN_MESSAGE, { message: detail })
    : jsonError(403, PAYROLL_ROUTE_FORBIDDEN_MESSAGE);
}

export function payrollRouteNotFound(detail = "Payroll run not found.") {
  return jsonError(404, PAYROLL_ROUTE_NOT_FOUND_MESSAGE, { message: detail });
}

export function payrollRouteUnexpected(detail?: string) {
  return detail
    ? jsonError(500, PAYROLL_ROUTE_UNEXPECTED_MESSAGE, { message: detail })
    : jsonError(500, PAYROLL_ROUTE_UNEXPECTED_MESSAGE);
}

export function payrollRouteSuccess<T extends Record<string, unknown>>(payload: T, message: string) {
  return jsonOk({ ...payload, message });
}
