// agui-starter/src/lib/env.ts
// Public envs must be referenced statically so Next.js inlines them in the client bundle.

export const NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;

export const NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

// Validate only on the server (build/runtime). Do NOT do dynamic access on the client.
if (typeof window === "undefined") {
  const missing: string[] = [];
  if (!NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
