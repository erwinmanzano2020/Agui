"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePosAccess } from "@/lib/pos/access";
import { getPriceForCustomerGroup, lookupProductByBarcode } from "@/lib/pos/products/server";
import { createSale, listRecentSales, loadSaleReceipt } from "@/lib/pos/sales/server";
import type { PosReceiptSale, RecentSaleSummary, SalesCartSnapshot, TenderInput } from "@/lib/pos/sales/types";

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

export async function resolveSaleScan(
  slug: string,
  input: { code: string; quantity?: number; customerId?: string | null; customerGroupId?: string | null },
) {
  const { house, supabase } = await resolveHouse(slug);
  const qty = Math.max(1, Math.trunc(input.quantity ?? 1));
  const customerId = input.customerId?.trim() || null;
  const customerGroupId = input.customerGroupId?.trim() || null;

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
  const { unitPrice, baseUnitPrice, tier, specialPricing } = await getPriceForCustomerGroup({
    houseId: house.id,
    itemId: snapshot.item.id,
    uomId: uom?.id ?? null,
    quantity: totalQuantity,
    customerId,
    customerGroupId,
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
    baseUnitPrice,
    specialPricing,
  } as const;
}

export async function priceSaleLine(
  slug: string,
  input: { itemId: string; uomId: string | null; quantity: number; customerId?: string | null; customerGroupId?: string | null },
) {
  const { house, supabase } = await resolveHouse(slug);
  const quantity = Math.max(0, Math.trunc(input.quantity));
  const customerId = input.customerId?.trim() || null;
  const customerGroupId = input.customerGroupId?.trim() || null;

  const { unitPrice, baseUnitPrice, tier, specialPricing } = await getPriceForCustomerGroup({
    houseId: house.id,
    itemId: input.itemId,
    uomId: input.uomId,
    quantity,
    customerId,
    customerGroupId,
    supabase,
  });

  return { unitPrice, tierTag: tier ? `Qty ${tier.min_quantity}+` : null, baseUnitPrice, specialPricing } as const;
}

export async function finalizeSaleAction(
  slug: string,
  input: {
    cart: SalesCartSnapshot;
    tenders: TenderInput[];
    customerId?: string | null;
    customerName?: string | null;
  },
): Promise<PosReceiptSale> {
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

export async function listRecentSalesAction(slug: string, limit = 50): Promise<RecentSaleSummary[]> {
  const { house, supabase } = await resolveHouse(slug);
  return listRecentSales(house.id, supabase, { limit });
}

export async function loadSaleReceiptAction(slug: string, saleId: string): Promise<PosReceiptSale | null> {
  const { supabase } = await resolveHouse(slug);
  return loadSaleReceipt(saleId, supabase);
}
