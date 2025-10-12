// agui-starter/src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
} from "./env";

let _client: SupabaseClient | null = null;

/**
 * Return a singleton Supabase client.
 * - In the browser, if env is missing, log a helpful error and return null
 *   (so pages can fail gracefully).
 * - On the server/build, throw so we fail fast.
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;

  const url = NEXT_PUBLIC_SUPABASE_URL;
  const anon = NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    if (typeof window !== "undefined") {
      console.error(
        "Supabase not configured. Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return null;
    }
    throw new Error(
      "Supabase not configured. Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  _client = createClient(url, anon);
  return _client;
}

/** Test-only helper to reset the cached client. */
export function __resetSupabaseForTests() {
  _client = null;
}
