import { NextResponse } from "next/server";

import { getCurrentEntity, normalizeIdentifier } from "@/lib/auth/entity";
import { ensureScheme } from "@/lib/loyalty/rules";
import { issueCard, loadCardsForEntity, updateCardFlags, rotateCardToken } from "@/lib/passes/cards";
import { getSupabase } from "@/lib/supabase";

const ALLOWED_SCOPES = new Set(["GUILD", "HOUSE"] as const);

type IdentifierPayload = {
  kind: "phone" | "email";
  value: string;
};

type IssueRequestBody = {
  scope?: "GUILD" | "HOUSE";
  scheme?: string;
  identifier?: IdentifierPayload;
  incognitoDefault?: boolean;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

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

  const body = (await req.json().catch(() => ({}))) as IssueRequestBody;
  const scope = body.scope;
  const identifier = body.identifier;

  if (!scope || !ALLOWED_SCOPES.has(scope)) {
    return NextResponse.json({ error: "scope must be GUILD or HOUSE" }, { status: 400 });
  }

  if (!identifier?.kind || !identifier.value) {
    return NextResponse.json({ error: "identifier is required" }, { status: 400 });
  }

  const normalizedValue = normalizeIdentifier(identifier.kind, identifier.value);
  const identifierType = identifier.kind === "email" ? "EMAIL" : "PHONE";

  const { data: identifierRow, error: identifierError } = await supabase
    .from("entity_identifiers")
    .select("entity_id")
    .eq("identifier_type", identifierType)
    .eq("identifier_value", normalizedValue)
    .maybeSingle();

  if (identifierError) {
    console.error("Failed to resolve identifier while issuing dev pass", identifierError);
    return NextResponse.json({ error: "Failed to resolve identifier" }, { status: 500 });
  }

  if (!identifierRow?.entity_id) {
    return NextResponse.json({ error: "Identifier not found" }, { status: 404 });
  }

  if (identifierRow.entity_id !== actor.id) {
    return NextResponse.json({ error: "You can only issue passes for your own entity in dev" }, { status: 403 });
  }

  try {
    const schemeName = body.scheme || (scope === "GUILD" ? "Guild Card" : "Patron Pass");
    const scheme = await ensureScheme(scope, schemeName, scope === "GUILD" ? 2 : 3);

    const cards = await loadCardsForEntity(actor.id, { supabase });
    const existing = cards.find((card) => card.scheme.id === scheme.id) ?? null;
    const targetIncognito = !!body.incognitoDefault && scheme.allow_incognito;

    let card = existing;
    if (card) {
      const currentIncognito = card.flags.incognito_default ?? false;
      if (currentIncognito !== targetIncognito) {
        card = await updateCardFlags(card.id, { incognito_default: targetIncognito }, { supabase });
      }
    } else {
      card = await issueCard({
        supabase,
        scheme,
        entityId: actor.id,
        incognitoDefault: targetIncognito,
      });
    }

    const rotation = await rotateCardToken(card.id, "qr", { supabase });

    return NextResponse.json({
      ok: true,
      card: {
        id: card.id,
        card_no: card.card_no,
        flags: card.flags,
        scheme: { id: scheme.id, name: scheme.name },
      },
      token_raw: rotation.token,
    });
  } catch (error) {
    console.error("Failed to issue dev pass", error);
    return NextResponse.json({ error: "Failed to issue pass" }, { status: 500 });
  }
}
