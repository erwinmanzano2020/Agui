import { NextResponse } from "next/server";
import { getOrCreateEntityByIdentifier } from "@/lib/auth/entity";
import { ensureScheme } from "@/lib/loyalty/rules";
import { ensureCard, rotateToken } from "@/lib/passes/cards";

/** Body: { scope: 'GUILD'|'HOUSE', scheme?: string, identifier:{kind:'phone'|'email', value}, incognitoDefault?: boolean } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const scope = body.scope as "GUILD" | "HOUSE";
  const schemeName = body.scheme || (scope === "GUILD" ? "Guild Card" : "Patron Pass");
  const id = body.identifier;
  const incog = !!body.incognitoDefault;

  if (!scope || !id?.kind || !id?.value) {
    return NextResponse.json({ error: "scope and identifier required" }, { status: 400 });
  }

  const scheme = await ensureScheme(scope, schemeName, scope === "GUILD" ? 2 : 3);
  const entity = await getOrCreateEntityByIdentifier(id.kind, id.value);
  const card = await ensureCard(scheme.id, entity.id, { incognitoDefault: incog });
  const token = await rotateToken(card.id, "qr");
  return NextResponse.json({ ok: true, card, token_raw: token.raw });
}
