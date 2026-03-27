export type MagicLinkErrorKind = "network" | "auth" | "config";

export type MagicLinkResult = {
  ok: boolean;
  error?: string;
  kind?: MagicLinkErrorKind;
  diagnostic?: string;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function sanitizeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string") return "/me";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return "/me";
  if (trimmed.startsWith("//")) return "/me";
  return trimmed;
}

export function buildMagicLinkRedirect(origin: string | null | undefined, next: string): string | undefined {
  if (typeof origin !== "string" || origin.trim().length === 0) {
    return undefined;
  }

  const safeOrigin = trimTrailingSlash(origin.trim());
  const safeNext = sanitizeNextPath(next);
  return `${safeOrigin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

export function classifyMagicLinkError(error: unknown): {
  kind: MagicLinkErrorKind;
  message: string;
  diagnostic: string;
} {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lowered = message.toLowerCase();

  if (
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror") ||
    lowered.includes("network request failed") ||
    lowered.includes("load failed")
  ) {
    return {
      kind: "network",
      message: "Could not reach the sign-in service. Check your connection and try again.",
      diagnostic: "network_unreachable",
    };
  }

  if (
    lowered.includes("supabase") && lowered.includes("configured") ||
    lowered.includes("invalid api key") ||
    lowered.includes("invalid url") ||
    lowered.includes("not configured")
  ) {
    return {
      kind: "config",
      message: "Sign-in is temporarily unavailable due to configuration. Please contact support.",
      diagnostic: "client_config_invalid",
    };
  }

  return {
    kind: "auth",
    message,
    diagnostic: "auth_api_error",
  };
}

export function magicLinkErrorMessage(result: MagicLinkResult): string {
  if (result.error) return result.error;
  return "Failed to send magic link.";
}
