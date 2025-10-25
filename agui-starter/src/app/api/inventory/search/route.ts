import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** Query params: q=barcode_or_name */
export async function GET(req: Request) {
  const db = getSupabase(); if (!db) return NextResponse.json({ items: [] });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if (!q) return NextResponse.json({ items: [] });

  // Try barcode exact first
  const byBarcode = await db.from("item_barcodes").select("item_id").eq("barcode", q).maybeSingle();
  if (byBarcode?.data?.item_id) {
    const { data: item } = await db.from("items").select("*").eq("id", byBarcode.data.item_id).maybeSingle();
    return NextResponse.json({ items: item ? [item] : [] });
  }

  // Fallback: name ilike
  const { data } = await db.from("items").select("*").ilike("name", `%${q}%`).limit(20);
  return NextResponse.json({ items: data ?? [] });
}
