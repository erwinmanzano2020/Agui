export function resolveLookupErrorMessage(payload: unknown): string {
  const detailsMessage =
    typeof payload === "object" &&
    payload !== null &&
    "details" in payload &&
    typeof (payload as { details?: { message?: unknown } }).details?.message === "string"
      ? (payload as { details: { message: string } }).details.message
      : null;

  const errorMessage =
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : null;

  return detailsMessage ?? errorMessage ?? "Unable to look up identities right now.";
}
