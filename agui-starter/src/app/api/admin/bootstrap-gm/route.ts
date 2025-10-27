import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ensureEntityByEmail } from "@/lib/identity/entity";
import { getServiceSupabase } from "@/lib/supabase-service";

export async function POST() {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
  const gmEmail = (process.env.GM_EMAIL || "").trim().toLowerCase();
  if (!secret || !gmEmail) {
    return NextResponse.json({ error: "Missing GM_EMAIL or ADMIN_BOOTSTRAP_SECRET" }, { status: 500 });
  }

  const hdr = headers().get("x-admin-secret");
  if (hdr !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const ent = await ensureEntityByEmail(gmEmail, { displayName: "Game Master" }, db);

  const up = await db
    .from("platform_roles")
    .upsert({ entity_id: ent.id, roles: ["game_master"] }, { onConflict: "entity_id" })
    .select("*")
    .single();

  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, platform_roles: up.data });
}
