import { NextResponse } from "next/server";
import { getOrCreateEntityByIdentifier } from "@/lib/auth/entity";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { kind, value } = body as { kind: "email" | "phone"; value: string };
  if (!kind || !value) return NextResponse.json({ error: "kind and value required" }, { status: 400 });
  const ent = await getOrCreateEntityByIdentifier(kind, value);
  return NextResponse.json({ entity: ent });
}
