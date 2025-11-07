import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    return NextResponse.json({
      ok: !error && !!data?.user,
      user: data?.user ?? null, // remove later if you want less detail
      error: error?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, fatal: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
