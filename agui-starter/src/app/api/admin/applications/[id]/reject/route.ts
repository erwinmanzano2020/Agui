// src/app/api/admin/applications/[id]/reject/route.ts
import { NextResponse, NextRequest } from "next/server";

import { z } from "@/lib/z";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EntityApplicationRow, EntityApplicationUpdate } from "@/lib/db.types";

const Params = z.object({ id: z.string().uuid() });

export async function POST(_req: NextRequest, { params }: { params: RouteParams<{ id: string }> }) {
  const { id } = Params.parse(await params);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patch: EntityApplicationUpdate = {
    status: "rejected",
    decided_at: new Date().toISOString(),
    decided_by_entity_id: user.id,
  };

  const { data, error } = await supabase
    .from("entity_applications")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle<EntityApplicationRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ ok: true, processed: false });
  }

  return NextResponse.json({ ok: true, application: data });
}
