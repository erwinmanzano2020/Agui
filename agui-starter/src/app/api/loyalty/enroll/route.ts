// src/app/api/loyalty/enroll/route.ts
import { NextResponse, NextRequest } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

/**
 * The service expects: { brandId: string; channel?: 'cashier'|'kiosk'|'self-service'; ... }
 * We validate and coerce channel to the allowed union.
 */

const Channel = z.enum(["cashier", "kiosk", "self-service"]);

const Body = z.object({
  brandId: z.string().uuid(),
  // Accept either the exact union or any string; coerce later to union or drop
  channel: z.string().optional(),
  // add any other inputs you support
  identifierKind: z.optional(z.enum(["email","phone","qr","gov_id","loyalty_card","employee_no","other"])),
  rawValue: z.optional(z.string().min(1)),
  issuer: z.optional(z.string().max(120)),
  meta: z.optional(z.record(z.string(), z.any())).default({}),
});

function normalizeChannel(input?: string) {
  if (!input) return undefined;
  const v = input.toLowerCase();
  if (Channel.options.includes(v as any)) return v as z.infer<typeof Channel>;
  return undefined; // refuse unknowns to satisfy the narrow union type
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const parsed = Body.parse(await req.json());

  // who am I?
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ensure current entity exists
  const { data: ent, error: entErr } = await supabase.rpc("ensure_entity_for_current_user");
  const entity = ent as { id?: string } | null;
  if (entErr || !entity?.id) {
    return NextResponse.json({ error: entErr?.message ?? "No entity" }, { status: 400 });
  }

  // Build a payload that conforms to EnrollMemberInput
  const payload = {
    brandId: parsed.brandId,
    channel: normalizeChannel(parsed.channel),
    identifierKind: parsed.identifierKind ?? null,
    rawValue: parsed.rawValue ?? null,
    issuer: parsed.issuer ?? null,
    meta: parsed.meta,
  };

  // For now, store as application; later we can auto-approve
  const { data: app, error: appErr } = await supabase
    .from("entity_applications" as never)
    .insert({
      applicant_entity_id: entity.id,
      target_brand_id: payload.brandId,
      kind: "loyalty_pass",
      identifier_kind: payload.identifierKind,
      raw_value: payload.rawValue,
      issuer: payload.issuer,
      meta: payload.meta,
    } as never)
    .select("*")
    .maybeSingle();

  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, application: app });
}
