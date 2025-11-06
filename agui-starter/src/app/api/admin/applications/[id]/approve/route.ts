// src/app/api/admin/applications/[id]/approve/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";
import type {
  EntityApplicationRow,
  EntityApplicationUpdate,
} from "@/lib/db.types";

const Params = z.object({ id: z.string().uuid() });

export async function POST(_req: NextRequest, { params }: { params: RouteParams<{ id: string }> }) {
  const { id } = Params.parse(await params);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patch: EntityApplicationUpdate = {
    status: "approved",
    decided_at: new Date().toISOString(),
    decided_by_entity_id: user.id,
  };

  const { data: app, error: updateError } = await supabase
    .from("entity_applications")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle<EntityApplicationRow>();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (!app) {
    return NextResponse.json({ ok: true, processed: false });
  }

  const deciderId = app.decided_by_entity_id ?? user.id;

  const { error: rpcError } = await supabase.rpc("process_application", {
    p_application_id: id,
    p_decider_entity_id: deciderId,
  });

  if (rpcError) {
    return NextResponse.json(
      {
        ok: true,
        processed: false,
        warning: `Approved but processing failed: ${rpcError.message}`,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, processed: true });
}
