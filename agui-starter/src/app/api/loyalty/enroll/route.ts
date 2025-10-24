import { NextResponse } from "next/server";
import { enrollEntity, ensureScheme } from "@/lib/loyalty/rules";
import { getOrCreateEntityByIdentifier } from "@/lib/auth/entity";

/** Body: { scope: 'GUILD'|'HOUSE', scheme?: string, identifier: { kind:'phone'|'email', value } } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const scope = body.scope as "GUILD" | "HOUSE" | undefined;
  const schemeName = (body.scheme as string) || (scope === "GUILD" ? "Guild Card" : "Patron Pass");
  const id = body.identifier as { kind: "phone" | "email"; value: string };

  if (!scope || !id?.kind || !id?.value) {
    return NextResponse.json({ error: "scope and identifier required" }, { status: 400 });
  }

  const scheme = await ensureScheme(scope, schemeName, scope === "GUILD" ? 2 : 3);
  const entity = await getOrCreateEntityByIdentifier(id.kind, id.value);
  const profile = await enrollEntity(scheme.id, entity.id);
  return NextResponse.json({ ok: true, scheme: { id: scheme.id, name: scheme.name }, entity_id: entity.id, profile });
}
