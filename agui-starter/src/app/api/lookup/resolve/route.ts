// src/app/api/lookup/resolve/route.ts
import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

type IdentifierKind =
  | "email"
  | "phone"
  | "qr"
  | "gov_id"
  | "loyalty_card"
  | "employee_no"
  | "other";

/** Precise RPC arg type to avoid `any`. */
type ResolveArgs = {
  p_kind: IdentifierKind;
  p_raw: string;
};

const bodySchema = z.object({
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
});

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const json = await req.json().catch(() => null);

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { kind, value } = parsed.data;
  const args: ResolveArgs = { p_kind: kind, p_raw: value };

  const rpcUntyped = supabase.rpc as unknown as (
    fn: string,
    a?: unknown
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const { data, error } = await rpcUntyped("resolve_entity_by_identifier", args as unknown);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  // data is expected to be entity_id | null
  const entityId = (data ?? null) as string | null;
  return NextResponse.json({ ok: true, found: !!entityId, entityId });
}
