"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePosAccess } from "@/lib/pos/access";
import { getPriceForCustomerGroup, lookupProductByBarcode } from "@/lib/pos/products/server";
import { createSale } from "@/lib/pos/sales/server";
import type { SalesCartSnapshot, TenderInput } from "@/lib/pos/sales/types";

type ResolvedUom = { id: string; code: string; label: string | null; factorToBase: number; isBase?: boolean };

async function resolveHouse(slug: string) {
  const nextPath = `/company/${slug}/pos/sales`;
  const { supabase } = await requireAuth(nextPath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    throw new Error("House not found");
  }

  await requirePosAccess(supabase, house.id, { dest: nextPath });

  return { house, supabase } as const;
}

function resolveUom(snapshotUoms: ResolvedUom[], barcodeCode: string | null, barcodes: Array<{ barcode: string; uom_id: string | null }>) {
  const baseUom = snapshotUoms.find((uom) => uom.isBase) ?? snapshotUoms[0];
  if (!barcodeCode) return baseUom;

  const matched = barcodes.find((row) => row.barcode === barcodeCode);
  if (!matched) return baseUom;

  const fromBarcode = matched.uom_id ? snapshotUoms.find((uom) => uom.id === matched.uom_id) : null;
  return fromBarcode ?? baseUom;
}

export async function resolveSaleScan(slug: string, input: { code: string; quantity?: number }) {
  const { house, supabase } = await resolveHouse(slug);
  const qty = Math.max(1, Math.trunc(input.quantity ?? 1));

  const lookup = await lookupProductByBarcode({ houseId: house.id, barcode: input.code, supabase });
  const snapshot = lookup.snapshot;

  if (!snapshot) {
    throw new Error("Item not found");
  }

  const uoms: ResolvedUom[] = snapshot.uoms.map((uom) => ({
    id: uom.id,
    code: uom.code,
    label: uom.name ?? uom.variant_label ?? null,
    factorToBase: uom.factor_to_base,
    isBase: uom.is_base,
  }));

  const uom = resolveUom(uoms, lookup.barcode, snapshot.barcodes);
  const totalQuantity = qty;
  const { unitPrice, tier } = await getPriceForCustomerGroup({
    houseId: house.id,
    itemId: snapshot.item.id,
    uomId: uom?.id ?? null,
    quantity: totalQuantity,
    supabase,
  });

  return {
    item: { id: snapshot.item.id, name: snapshot.item.name },
    barcode: lookup.barcode,
    uoms,
    uomId: uom?.id ?? null,
    quantity: totalQuantity,
    unitPrice,
    tierTag: tier ? `Qty ${tier.min_quantity}+` : null,
  } as const;
}

export async function priceSaleLine(
  slug: string,
  input: { itemId: string; uomId: string | null; quantity: number },
) {
  const { house, supabase } = await resolveHouse(slug);
  const quantity = Math.max(0, Math.trunc(input.quantity));

  const { unitPrice, tier } = await getPriceForCustomerGroup({
    houseId: house.id,
    itemId: input.itemId,
    uomId: input.uomId,
    quantity,
    supabase,
  });

  return { unitPrice, tierTag: tier ? `Qty ${tier.min_quantity}+` : null } as const;
}

export async function finalizeSaleAction(
  slug: string,
  input: {
    cart: SalesCartSnapshot;
    tenders: TenderInput[];
    customerId?: string | null;
    customerName?: string | null;
  },
) {
  const { house, supabase } = await resolveHouse(slug);

  return createSale(
    {
      houseId: house.id,
      cart: input.cart,
      tenders: input.tenders,
      customerId: input.customerId,
      customerName: input.customerName,
    },
    supabase,
  );
}
