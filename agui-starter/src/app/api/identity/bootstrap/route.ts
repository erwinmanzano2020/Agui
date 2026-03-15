// src/app/api/identity/bootstrap/route.ts
import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { ensureEntityForCurrentUser } from "@/lib/identity/bootstrap.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const Body = z.object({ phone: z.string().optional() });

export async function POST(req: Request) {
  // Must be authenticated
  const sb = await createServerSupabaseClient();
  const { data: s } = await sb.auth.getUser();
  if (!s?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", issues: parsed.error.issues }, { status: 400 });
  }

  const res = await ensureEntityForCurrentUser(parsed.data);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true, entityId: res.entityId });
}
