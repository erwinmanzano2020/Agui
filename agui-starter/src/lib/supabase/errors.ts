// src/lib/supabase/errors.ts
import type { PostgrestError } from "@supabase/supabase-js";

function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Returns true when the error is a missing relation/table or permission error
 * we want to treat as optional metadata in environments without those tables.
 */
export function isOptionalTableError(error: unknown): boolean {
  const code = extractErrorCode(error);
  return code === "42P01" || code === "PGRST205" || code === "PGRST204" || code === "42501";
}

export function shouldSilenceMissingRelation(error: PostgrestError | null): boolean {
  return Boolean(error && isOptionalTableError(error));
}
