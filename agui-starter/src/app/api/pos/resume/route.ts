import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

type ResumeRequestBody = {
  companyId?: string;
  saleId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ResumeRequestBody;
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  if (!body.companyId && !body.saleId) {
    return NextResponse.json({ error: "Missing company or sale" }, { status: 400 });
  }

  let saleId: string | undefined = body.saleId;
  if (!saleId) {
    const latest = await db
      .from("sales")
      .select("id")
      .eq("company_id", body.companyId!)
      .eq("status", "HELD")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    saleId = latest.data?.id ?? undefined;
  }

  if (!saleId) {
    return NextResponse.json({ error: "No held sale" }, { status: 404 });
  }

  const sale = await db.from("sales").select("*").eq("id", saleId).maybeSingle();
  const lines = await db.from("sale_lines").select("*").eq("sale_id", saleId);

  return NextResponse.json({ sale: sale.data, lines: lines.data ?? [] });
}
