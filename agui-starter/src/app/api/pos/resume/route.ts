import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  let saleId: string | undefined = body.saleId;
  if (!saleId) {
    const latest = await db
      .from("sales")
      .select("id")
      .eq("company_id", body.companyId)
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
