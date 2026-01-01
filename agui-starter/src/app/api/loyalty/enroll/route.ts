import { NextRequest, NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const Channel = z.enum(["cashier", "kiosk", "self-service"]);

const Body = z.object({
  brandId: z.string().uuid(),
  channel: z.string().optional(),
  identifierKind: z
    .enum(["email", "phone", "qr", "gov_id", "loyalty_card", "employee_no", "other"])
    .optional(),
  rawValue: z.string().min(1).optional(),
  issuer: z.string().max(120).optional(),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
});

function normalizeChannel(input?: string) {
  if (!input) return undefined;
  const value = input.toLowerCase();
  const parsed = Channel.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const parsed = Body.parse(await req.json());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ent, error: entErr } = await supabase.rpc("ensure_entity_for_current_user");
  if (entErr) {
    return NextResponse.json({ error: entErr.message }, { status: 400 });
  }

  const applicantEntityId = (ent as { id?: string } | null)?.id;
  if (!applicantEntityId) {
    return NextResponse.json({ error: "No entity" }, { status: 400 });
  }

  const payload = {
    brandId: parsed.brandId,
    channel: normalizeChannel(parsed.channel),
    identifierKind: parsed.identifierKind ?? null,
    rawValue: parsed.rawValue ?? null,
    issuer: parsed.issuer ?? null,
    meta: parsed.meta,
  };

  const { data: app, error: appErr } = await supabase
    .from("entity_applications" as never)
    .insert({
      applicant_entity_id: applicantEntityId,
      target_brand_id: payload.brandId,
      kind: "loyalty_pass",
      identifier_kind: payload.identifierKind,
      raw_value: payload.rawValue,
      issuer: payload.issuer,
      meta: payload.meta,
    } as never)
    .select("*")
    .maybeSingle();

  if (appErr) {
    return NextResponse.json({ error: appErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, application: app });
}
