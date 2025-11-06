// src/app/api/identifiers/link/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/auth/server";
import type { EntityIdentifierInsert, Json } from "@/lib/db.types";
import { z } from "@/lib/z";

const bodySchema = z.object({
  entityId: z.string().uuid().optional(), // default = current user
  kind: z.enum([
    "email",
    "phone",
    "qr",
    "gov_id",
    "loyalty_card",
    "employee_no",
    "other",
  ]),
  value: z.string().min(1, "value is required"),
  issuer: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  // Require auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const currentEntityId = userRes.user.id;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { entityId, kind, value, issuer, meta } = parsed.data;
  const metaJson: Json | null = meta == null ? null : (meta as unknown as Json);

  const row: EntityIdentifierInsert = {
    entity_id: entityId ?? currentEntityId,
    kind,
    value_norm: value, // normalized/hashed in trigger
    issuer: issuer ?? null,
    meta: metaJson,
    added_by_entity_id: currentEntityId,
  };

  const { data, error } = await supabase
    .from("entity_identifiers")
    .insert(row)
    .select("id, entity_id, kind, issuer, value_norm, verified_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, row: data ?? null });
}
