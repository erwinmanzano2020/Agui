// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * We must NOT read env vars or create the client at module load time,
 * otherwise Next.js "collect page data" in CI will fail if envs are absent.
 * This module exports a lazy proxy. The real client is created on first use.
 */

let _client: SupabaseClient | null = null;

function createLazyClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Throw ONLY when actually used at runtime (e.g., an API call),
    // never at import time.
    throw new Error(
      "Supabase env missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY).",
    );
  }

  _client = createClient(url, anonKey, {
    auth: {
      // For server handlers we generally don't persist session
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

/**
 * Export a Proxy named `supabase` so existing imports keep working:
 *   import { supabase } from "@/lib/supabase";
 *
 * The proxy defers client creation until a property is accessed.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = createLazyClient();
    // @ts-expect-error dynamic proxy
    return client[prop];
  },
  apply(_target, thisArg, argArray) {
    const client = createLazyClient();
    // @ts-expect-error dynamic proxy call
    return client.apply(thisArg, argArray);
  },
});

/** Optional: direct getter if you prefer explicit usage in new code. */
export function getSupabase(): SupabaseClient {
  return createLazyClient();
}
