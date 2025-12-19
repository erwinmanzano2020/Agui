type ApiLogLevel = "info" | "warn" | "error";

type ApiLogContext = {
  route: string;
  action: string;
  userId?: string | null;
  entityId?: string | null;
  houseId?: string | null;
  details?: Record<string, unknown>;
  error?: unknown;
  level?: ApiLogLevel;
};

type ErrorDetails = {
  message: string;
  code?: string;
  name?: string;
};

function extractErrorDetails(error: unknown): ErrorDetails {
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; code?: unknown; name?: unknown };
    const message =
      typeof candidate.message === "string"
        ? candidate.message
        : typeof error.toString === "function"
          ? error.toString()
          : "Unknown error";

    const code = typeof candidate.code === "string" ? candidate.code : undefined;
    const name = typeof candidate.name === "string" ? candidate.name : undefined;

    return { message, code, name } satisfies ErrorDetails;
  }

  return { message: String(error) } satisfies ErrorDetails;
}

export function logApiEvent(context: ApiLogContext) {
  const { route, action, userId, entityId, houseId, details, level = "info", error } = context;
  const errorDetails = error ? extractErrorDetails(error) : null;

  const payload = {
    route,
    action,
    userId: userId ?? null,
    entityId: entityId ?? null,
    houseId: houseId ?? null,
    ...(details ? { details } : {}),
    ...(errorDetails ? { error: errorDetails } : {}),
  };

  if (level === "error") {
    console.error("[api]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[api]", payload);
    return;
  }

  console.info("[api]", payload);
}

export function logApiError(context: Omit<ApiLogContext, "level">) {
  logApiEvent({ ...context, level: "error" });
}

export function logApiWarning(context: Omit<ApiLogContext, "level">) {
  logApiEvent({ ...context, level: "warn" });
}
