// agui-starter/src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV, assertPublicEnvOnServer } from "./env";

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client.
 * - In the **browser**, if envs are missing, log a helpful message and return `null`
 *   so pages can fail gracefully (no hard crash).
 * - On the **server/build**, assert and throw early if envs are missing.
 */
export function getSupabase(): SupabaseClient | null {
  const url = ENV.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    if (typeof window !== "undefined") {
      console.error(
        "Supabase not configured. Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return null;
    }
    // server/build: fail fast
    assertPublicEnvOnServer();
    // ^ throws with a clear message; return is only for type satisfaction
    return null;
  }

  if (_client) return _client;
  _client = createClient(url, anon);
  return _client;
}

/** Test-only helper to reset the cached client. */
export function __resetSupabaseForTests() {
  _client = null;
}
