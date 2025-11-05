// src/app/api/admin/applications/[id]/approve/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

const Params = z.object({
  id: z.string().uuid(),
});

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parse = Params.safeParse(await context.params);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const appId = parse.data.id;

  // 1) Approve in place (status change & audit)
  const { error: upErr } = await supabase
    .from("entity_applications" as never)
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by_entity_id: user.id,
    } as never)
    .eq("id", appId);

  if (upErr) {
    return NextResponse.json({ error: `Approve failed: ${upErr.message}` }, { status: 500 });
  }

  // 2) Trigger safe side-effects in DB
  const { error: rpcErr } = await supabase.rpc(
    "process_application",
    {
      p_application_id: appId,
      p_decider_entity_id: user.id,
    } as never,
  );

  // Even if RPC fails, the approval stands — but we report it
  if (rpcErr) {
    return NextResponse.json(
      { ok: true, processed: false, warning: `Approved but processing failed: ${rpcErr.message}` },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, processed: true }, { status: 200 });
}
