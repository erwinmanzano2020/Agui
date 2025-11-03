import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabase } from "@/lib/auth/server";

const BodySchema = z.object({
  entityId: z.string().uuid(),
  isGm: z.boolean(),
});

type BodyInput = z.infer<typeof BodySchema>;

function parseBody(json: unknown): BodyInput {
  return BodySchema.parse(json);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entityId, isGm } = parseBody(json);

    const supabase = await createServerSupabase();

    const { data: userRes, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }
    if (!userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: gmFlag, error: gmError } = await supabase.rpc("current_entity_is_gm");
    if (gmError) {
      return NextResponse.json({ error: gmError.message }, { status: 500 });
    }
    if (!gmFlag) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.rpc("admin_set_gm", {
      p_entity_id: entityId,
      p_is_gm: isGm,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
