// src/app/api/identifiers/link/route.ts
import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

const bodySchema = z.object({
  entityId: z.string().uuid().optional(), // if omitted, link to current entity
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
  meta: z.record(z.any()).optional(),
});

export async function POST(req: Request) {
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

  // Insert; RLS enforces:
  // - self can add for self
  // - GM can add for anyone
  const { data, error } = await supabase
    .from("entity_identifiers")
    .insert({
      entity_id: entityId ?? currentEntityId,
      kind,
      value_norm: value, // normalized/hashed in trigger
      issuer: issuer ?? null,
      meta: meta ?? {},
      added_by_entity_id: currentEntityId,
    })
    .select("id, entity_id, kind, issuer, value_norm, verified_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, row: data });
}
