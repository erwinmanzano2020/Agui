// agui-starter/src/lib/env.ts
const requiredPublic = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type PublicKey = typeof requiredPublic[number];

function read(k: PublicKey): string {
  const v = process.env[k];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable: ${k}`);
  }
  return v;
}

export const NEXT_PUBLIC_SUPABASE_URL = read("NEXT_PUBLIC_SUPABASE_URL");
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = read(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
