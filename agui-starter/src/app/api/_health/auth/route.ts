import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    return NextResponse.json({
      ok: !error && !!data?.user,
      user: data?.user ?? null,
      error: error?.message ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    return NextResponse.json({ ok: false, fatal: message }, { status: 500 });
  }
}
