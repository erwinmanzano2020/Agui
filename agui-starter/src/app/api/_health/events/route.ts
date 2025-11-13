import { NextResponse } from "next/server";

import { currentEntityIsGM } from "@/lib/authz/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const isGM = await currentEntityIsGM(supabase);
    if (!isGM) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const svc = createServiceSupabaseClient();
    const { data, error } = await svc
      .from("event_log")
      .select("id, topic, kind, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, count: data?.length ?? 0, events: data ?? [] });
  } catch (err) {
    console.error("events health failed", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
