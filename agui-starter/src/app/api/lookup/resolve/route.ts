// src/app/api/lookup/resolve/route.ts
import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

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

  // Use DB resolver (normalized & hashed in SQL).
  const { data, error } = await supabase.rpc("resolve_entity_by_identifier", {
    p_kind: kind,
    p_raw: value,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, found: !!data, entityId: data ?? null });
}
