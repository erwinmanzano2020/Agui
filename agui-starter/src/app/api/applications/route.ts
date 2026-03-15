import { NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase-service";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const businessSlug = normalizeString((body as { businessSlug?: unknown }).businessSlug);
  const name = normalizeString((body as { name?: unknown }).name);
  const emailRaw = normalizeString((body as { email?: unknown }).email);
  const phoneRaw = normalizeString((body as { phone?: unknown }).phone);

  if (!businessSlug) {
    return NextResponse.json({ error: "businessSlug is required" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!emailRaw && !phoneRaw) {
    return NextResponse.json({ error: "email_or_phone_required" }, { status: 400 });
  }

  const service = getServiceSupabase();
  const { data: house, error: houseError } = await service
    .from("houses")
    .select("id")
    .eq("slug", businessSlug)
    .maybeSingle();

  if (houseError) {
    console.error("Failed to resolve business slug", houseError);
    return NextResponse.json({ error: "Failed to resolve business" }, { status: 500 });
  }

  if (!house) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const payload = {
    business_id: house.id,
    name,
    email: emailRaw || null,
    phone: phoneRaw || null,
    status: "pending" as const,
  };

  const { error } = await service.from("applications").insert(payload as never);
  if (error) {
    console.error("Failed to create application", error);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
