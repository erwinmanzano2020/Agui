import { NextResponse } from "next/server";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { getSupabase } from "@/lib/supabase";

type FinalizeLinePayload = {
  itemId: string;
  uom?: string;
  multiplier?: number;
  qty: number;
  unitPriceCentavos: number;
  lineTotalCentavos: number;
};

type FinalizeRequestBody = {
  companyId?: string;
  deviceId?: string;
  localSeq?: number;
  saleId?: string;
  version?: number;
  grandTotalCentavos?: number;
  lines?: FinalizeLinePayload[];
};

export async function POST(req: Request) {
  await requireFeatureAccess(AppFeature.POS, { dest: new URL(req.url).pathname });
  const body = (await req.json().catch(() => ({}))) as FinalizeRequestBody;
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  if (!body.companyId || !body.deviceId || typeof body.localSeq !== "number") {
    return NextResponse.json({ error: "Missing finalize identifiers" }, { status: 400 });
  }

  const { companyId, deviceId, localSeq } = body;

  const key = await db
    .from("sale_finalize_keys")
    .select("sale_id")
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .eq("local_seq", localSeq)
    .maybeSingle();

  if (key.data?.sale_id) {
    return NextResponse.json({ ok: true, saleId: key.data.sale_id, idempotent: true });
  }

  const { data: sale, error: upsertError } = await db
    .from("sales")
    .upsert(
      {
        id: body.saleId ?? undefined,
        company_id: companyId,
        device_id: deviceId,
        status: "COMPLETED",
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

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length) {
    const rows = lines.map((line, index) => ({
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

  await db.from("sale_finalize_keys").insert({
    company_id: companyId,
    device_id: deviceId,
    local_seq: localSeq,
    sale_id: sale.id,
  });

  return NextResponse.json({ ok: true, saleId: sale.id });
}
