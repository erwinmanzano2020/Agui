import { NextResponse } from "next/server";

import { getCurrentEntity } from "@/lib/auth/entity";
import { ensureInventoryAccess } from "@/lib/inventory/access";
import { adoptIntoHouse, ensureGlobalItemFromBarcode } from "@/lib/inventory/items";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
  }

  const actor = await getCurrentEntity({ supabase });
  if (!actor) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: house, error: houseError } = await supabase
    .from("houses")
    .select("id, guild_id")
    .eq("id", companyId)
    .maybeSingle();

  if (houseError) {
    return NextResponse.json({ error: "Failed to load company" }, { status: 500 });
  }

  if (!house) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const hasAccess = await ensureInventoryAccess({
    supabase,
    houseId: house.id,
    guildId: house.guild_id ?? null,
    entityId: actor.id,
  }).catch((error: unknown) => {
    console.error("Failed to verify inventory access", error);
    return null;
  });

  if (hasAccess !== true) {
    return NextResponse.json({ error: "Inventory access denied" }, { status: hasAccess === null ? 500 : 403 });
  }

  const item = await ensureGlobalItemFromBarcode(barcode, { nameHint, supabase });
  const centavos = Number(priceCentavos ?? 0);
  const houseItem = await adoptIntoHouse({
    supabase,
    houseId: house.id,
    itemId: item.id,
    priceCentavos: Number.isFinite(centavos) ? centavos : 0,
    sku,
  });

  return NextResponse.json({ ok: true, item, house_item: houseItem });
}
