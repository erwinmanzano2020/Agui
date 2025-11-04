import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

const Body = z.object({
  entityId: z.string().uuid(),
  isGm: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let json: unknown = {};

    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch (parseErr) {
        const message = parseErr instanceof Error ? parseErr.message : "Bad request";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const { entityId, isGm } = Body.parse(json);

    const supabase = await createServerSupabase();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
    if (!userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: isGmNow,
      error: gmErr,
    } = await (supabase as any).rpc("current_entity_is_gm");
    if (gmErr) {
      return NextResponse.json({ error: gmErr.message }, { status: 500 });
    }
    if (!isGmNow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await (supabase as any).rpc("admin_set_gm", {
      p_entity_id: entityId,
      p_is_gm: isGm,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
