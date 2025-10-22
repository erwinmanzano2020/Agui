// agui-starter/src/lib/env.ts

// Public envs must be referenced statically so Next.js inlines them in the client bundle.
export const NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;

export const NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const AGUI_TAXONOMY_V2 = process.env.AGUI_TAXONOMY_V2 === "true";

/**
 * Validate only on the server (build/runtime). Do NOT throw in the browser at import time.
 * Call this from server code right before you need the values (e.g., in an API route).
 */
export function assertPublicEnvOnServer() {
  if (typeof window !== "undefined") return; // never throw in the browser

  const missing: string[] = [];
  if (!NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}
