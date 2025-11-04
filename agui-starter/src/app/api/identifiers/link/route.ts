// src/app/api/identifiers/link/route.ts
import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

/**
 * Minimal insert shape for entity_identifiers.
 * TODO: replace with generated DB types when available.
 */
type IdentifierKind =
  | "email"
  | "phone"
  | "qr"
  | "gov_id"
  | "loyalty_card"
  | "employee_no"
  | "other";

type EntityIdentifierInsert = {
  entity_id: string;
  kind: IdentifierKind;
  value_norm: string;
  issuer: string | null;
  meta: Record<string, unknown>;
  added_by_entity_id: string;
};

type EntityIdentifierReturn = {
  id: string;
  entity_id: string;
  kind: IdentifierKind;
  issuer: string | null;
  value_norm: string;
  verified_at: string | null;
};

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

  const row: EntityIdentifierInsert = {
    entity_id: entityId ?? currentEntityId,
    kind,
    value_norm: value, // normalized/hashed in trigger
    issuer: issuer ?? null,
    meta: meta ?? {},
    added_by_entity_id: currentEntityId,
  };

  // Avoid generics on .from(...) until DB types exist; use a temporary untyped shim.
  const fromUntyped = supabase.from as unknown as (
    table: string
  ) => {
    insert: (values: unknown) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await fromUntyped("entity_identifiers")
    .insert(row as unknown)
    .select("id, entity_id, kind, issuer, value_norm, verified_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const out = (data ?? null) as EntityIdentifierReturn | null;
  return NextResponse.json({ ok: true, row: out });
}
