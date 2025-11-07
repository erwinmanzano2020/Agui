import { NextResponse } from "next/server";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export async function GET() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  return NextResponse.json(
    {
      ok: missing.length === 0,
      missing,
    },
    { status: missing.length === 0 ? 200 : 500 },
  );
}
