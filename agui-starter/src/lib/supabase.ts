// agui-starter/src/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, assertPublicEnvOnServer } from './env';

let _client: SupabaseClient | null = null;

/**
 * Call this wherever you need Supabase. It lazily creates the client.
 * - On the server: throws if env is missing (so CI/build fails loudly).
 * - In the browser: logs a clear error but does NOT crash the app.
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = ENV.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    if (typeof window !== 'undefined') {
      // Don’t crash the browser — show a helpful message in DevTools.
      console.error(
        'Supabase not configured. Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
    } else {
      // On server/build we want to fail fast.
      assertPublicEnvOnServer();
    }
  }

  _client = createClient(url ?? '', anon ?? '');
  return _client;
}

// Old imports like `import { supabase } from './supabase'` still work:
export const supabase = getSupabase();
