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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : JSON.stringify(e, null, 2);
    return NextResponse.json({ ok: false, fatal: message }, { status: 500 });
  }
}
