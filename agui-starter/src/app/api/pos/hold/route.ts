import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: sale, error: upsertError } = await db
    .from("sales")
    .upsert(
      {
        id: body.saleId ?? undefined,
        company_id: body.companyId,
        device_id: body.deviceId,
        status: "HELD",
        grand_total_centavos: body.grandTotalCentavos ?? 0,
        version: (body.version ?? 0) + 1,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  await db.from("sale_lines").delete().eq("sale_id", sale.id);

  if (Array.isArray(body.lines) && body.lines.length) {
    const rows = body.lines.map((line: any, index: number) => ({
      sale_id: sale.id,
      line_no: index + 1,
      item_id: line.itemId,
      uom: line.uom || "UNIT",
      multiplier: line.multiplier || 1,
      qty: line.qty,
      unit_price_centavos: line.unitPriceCentavos,
      line_total_centavos: line.lineTotalCentavos,
    }));

    await db.from("sale_lines").insert(rows);
  }

  await db.from("sale_holds").upsert({
    sale_id: sale.id,
    reason: body.reason ?? null,
    hold_by_entity_id: body.actorEntityId ?? null,
    hold_device_id: body.deviceId,
    hold_token: body.holdToken ?? null,
  });

  return NextResponse.json({ ok: true, saleId: sale.id });
}
