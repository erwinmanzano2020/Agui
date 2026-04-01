import type { PosSessionAuthError } from "@/lib/pos/session-auth";

export const CLIENT_SAFE_POS_SESSION_ERROR = "Unable to complete POS session request.";

export function mapPosSessionClientError(error: PosSessionAuthError): string {
  switch (error.code) {
    case "INVALID_OPERATOR_CREDENTIALS":
    case "DEVICE_UNAVAILABLE":
    case "DEVICE_SCOPE_DENIED":
    case "SESSION_ALREADY_OPEN":
    case "SESSION_NOT_FOUND":
    case "SESSION_SCOPE_DENIED":
      return CLIENT_SAFE_POS_SESSION_ERROR;
    default:
      return CLIENT_SAFE_POS_SESSION_ERROR;
  }
}
