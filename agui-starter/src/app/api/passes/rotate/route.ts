import { NextResponse } from "next/server";
import { rotateToken } from "@/lib/passes/cards";

/** Body: { cardId: string } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let cardId = body.cardId as string | undefined;
  if (!cardId) {
    const form = await req.formData().catch(() => undefined);
    cardId = form?.get("cardId")?.toString();
  }
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });
  const t = await rotateToken(cardId, "qr");
  return NextResponse.json({ ok: true, token_raw: t.raw });
}
