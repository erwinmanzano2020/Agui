// agui-starter/src/lib/env.ts
// Single source of truth for PUBLIC envs. Never crash the *browser* at import time.

type PublicKey = 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

function read(k: PublicKey): string | undefined {
  // Next inlines NEXT_PUBLIC_* at build time. In the browser, missing values
  // would be `undefined` literals. Don’t throw here to avoid client crashes.
  // On the server/build, we *do* want to fail fast, but not at import time.
  return process.env[k];
}

export const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: read('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
};

// Helper to assert on the server when we actually need the values.
export function assertPublicEnvOnServer() {
  if (typeof window !== 'undefined') return; // never throw in browser
  const missing: string[] = [];
  if (!ENV.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
}
