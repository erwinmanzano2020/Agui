import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const Body = z.object({
  brandId: z.string().uuid().optional(),
  role: z.enum(["employment","brand_owner","admin_request"]),
  identifierKind: z.optional(z.enum(["email","phone","qr","gov_id","loyalty_card","employee_no","other"])),
  rawValue: z.optional(z.string().min(1)),
  issuer: z.optional(z.string().max(120)),
  meta: z.optional(z.record(z.string(), z.any())).default({})
});

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const body = Body.parse(await req.json());

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ent } = await supabase.rpc("ensure_entity_for_current_user");
  const applicantEntityId = (ent as { id?: string } | null)?.id;
  if (!applicantEntityId) return NextResponse.json({ error: "No entity" }, { status: 400 });

  const row = {
    applicant_entity_id: applicantEntityId,
    target_brand_id: body.brandId ?? null,
    kind: body.role === "employment" ? "employment"
         : body.role === "brand_owner" ? "brand_owner"
         : "admin_request",
    identifier_kind: body.identifierKind ?? null,
    raw_value: body.rawValue ?? null,
    issuer: body.issuer ?? null,
    meta: body.meta
  };

  const { data, error } = await supabase
    .from("entity_applications" as never)
    .insert(row as never)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, application: data });
}
