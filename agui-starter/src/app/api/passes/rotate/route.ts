import { NextResponse } from "next/server";

import { getCurrentEntity } from "@/lib/auth/entity";
import { loadCardById, rotateCardToken } from "@/lib/passes/cards";
import { getSupabase } from "@/lib/supabase";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

type RotateRequest = {
  cardId?: string;
};

export async function POST(req: Request) {
  if (isProduction()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
  }

  const actor = await getCurrentEntity({ supabase });
  if (!actor) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RotateRequest;
  if (!body.cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  try {
    const card = await loadCardById(body.cardId, { supabase });
    if (!card || card.entity_id !== actor.id) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const rotation = await rotateCardToken(card.id, "qr", { supabase });
    return NextResponse.json({ ok: true, token_raw: rotation.token });
  } catch (error) {
    console.error("Failed to rotate dev pass token", error);
    return NextResponse.json({ error: "Failed to rotate token" }, { status: 500 });
  }
}
