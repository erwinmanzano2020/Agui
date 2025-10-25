import { NextResponse } from "next/server";

import { adoptIntoHouse, ensureGlobalItemFromBarcode } from "@/lib/inventory/items";

type AdoptRequestBody = {
  companyId?: string;
  barcode?: string;
  priceCentavos?: number;
  sku?: string;
  nameHint?: string;
};

function parseRequestBody(input: unknown): AdoptRequestBody {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;
  const toOptionalString = (value: unknown) =>
    typeof value === "string" ? value : value != null ? String(value) : undefined;

  const toOptionalNumber = (value: unknown) =>
    typeof value === "number"
      ? value
      : value != null
        ? Number(value)
        : undefined;

  return {
    companyId: toOptionalString(source.companyId),
    barcode: toOptionalString(source.barcode),
    priceCentavos: toOptionalNumber(source.priceCentavos),
    sku: toOptionalString(source.sku),
    nameHint: toOptionalString(source.nameHint),
  };
}

/** Body: { companyId: string, barcode: string, priceCentavos?: number, sku?: string, nameHint?: string } */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const { companyId, barcode, priceCentavos, sku, nameHint } = parseRequestBody(raw);

  if (!companyId || !barcode) {
    return NextResponse.json(
      { error: "companyId and barcode required" },
      { status: 400 },
    );
  }

  const item = await ensureGlobalItemFromBarcode(barcode, { nameHint });
  const centavos = Number(priceCentavos ?? 0);
  const houseItem = await adoptIntoHouse(
    companyId,
    item.id,
    Number.isFinite(centavos) ? centavos : 0,
    sku,
  );

  return NextResponse.json({ ok: true, item, house_item: houseItem });
}
