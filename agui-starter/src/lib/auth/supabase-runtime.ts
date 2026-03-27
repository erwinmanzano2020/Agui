export type SupabaseRuntimeDiagnostic =
  | "ok"
  | "missing_supabase_url"
  | "invalid_supabase_url"
  | "same_origin_supabase_url";

export type SupabaseRuntimeCheck = {
  ok: boolean;
  diagnostic: SupabaseRuntimeDiagnostic;
  targetOrigin?: string;
  authEndpoint?: string;
};

export function inspectSupabaseRuntimeConfig(input: {
  supabaseUrl: string | null | undefined;
  currentOrigin?: string | null;
}): SupabaseRuntimeCheck {
  const raw = typeof input.supabaseUrl === "string" ? input.supabaseUrl.trim() : "";
  if (!raw) {
    return { ok: false, diagnostic: "missing_supabase_url" };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, diagnostic: "invalid_supabase_url" };
  }

  if (!(parsed.protocol === "https:" || parsed.protocol === "http:")) {
    return { ok: false, diagnostic: "invalid_supabase_url" };
  }

  const targetOrigin = parsed.origin;
  const authEndpoint = `${targetOrigin}/auth/v1/otp`;

  if (input.currentOrigin && targetOrigin === input.currentOrigin) {
    return {
      ok: false,
      diagnostic: "same_origin_supabase_url",
      targetOrigin,
      authEndpoint,
    };
  }

  return { ok: true, diagnostic: "ok", targetOrigin, authEndpoint };
}
