import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("introspect_public_schema");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, schema: data }, { headers: { "cache-control": "no-store" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ ok: false, fatal: message }, { status: 500 });
  }
}
