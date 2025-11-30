"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePosAccess } from "@/lib/pos/access";
import { getPriceForCustomerGroup, lookupProductByBarcode } from "@/lib/pos/products/server";
import { closeShift, computeShiftTotals, getOpenShiftForUser, openShift } from "@/lib/pos/shifts/server";
import type { PosShiftRow, PosShiftSummary } from "@/lib/pos/shifts/types";
import { createSale, listRecentSales, loadSaleReceipt } from "@/lib/pos/sales/server";
import type {
  LoadSaleReceiptResult,
  PosReceiptSale,
  RecentSaleSummary,
  SalesCartSnapshot,
  TenderInput,
} from "@/lib/pos/sales/types";

type ResolvedUom = { id: string; code: string; label: string | null; factorToBase: number; isBase?: boolean };

type SerializableShift = {
  id: string;
  openedAt: string;
  openingCashCents: number;
  expectedCashCents: number;
  countedCashCents: number;
  status: PosShiftRow["status"];
};

type SerializableShiftSummary = {
  shift: SerializableShift;
  totalSalesCents: number;
  totalCashTenderCents: number;
  totalNonCashTenderCents: number;
  totalCreditTenderCents: number;
  expectedCashCents: number;
  cashOverShortCents: number;
};

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

  const decision = await requirePosAccess(supabase, house.id, { dest: nextPath });

  return { house, supabase, decision } as const;
}

function resolveUom(snapshotUoms: ResolvedUom[], barcodeCode: string | null, barcodes: Array<{ barcode: string; uom_id: string | null }>) {
  const baseUom = snapshotUoms.find((uom) => uom.isBase) ?? snapshotUoms[0];
  if (!barcodeCode) return baseUom;

  const matched = barcodes.find((row) => row.barcode === barcodeCode);
  if (!matched) return baseUom;

  const fromBarcode = matched.uom_id ? snapshotUoms.find((uom) => uom.id === matched.uom_id) : null;
  return fromBarcode ?? baseUom;
}

function serializeShift(row: PosShiftRow): SerializableShift {
  return {
    id: row.id,
    openedAt: row.opened_at,
    openingCashCents: row.opening_cash_cents ?? 0,
    expectedCashCents: row.expected_cash_cents ?? 0,
    countedCashCents: row.counted_cash_cents ?? 0,
    status: row.status,
  } satisfies SerializableShift;
}

function serializeSummary(summary: PosShiftSummary): SerializableShiftSummary {
  return {
    shift: serializeShift(summary.shift),
    totalSalesCents: summary.totalSalesCents,
    totalCashTenderCents: summary.totalCashTenderCents,
    totalNonCashTenderCents: summary.totalNonCashTenderCents,
    totalCreditTenderCents: summary.totalCreditTenderCents,
    expectedCashCents: summary.expectedCashCents,
    cashOverShortCents: summary.cashOverShortCents,
  } satisfies SerializableShiftSummary;
}

function requireEntityId(decision: { entityId: string | null }) {
  if (!decision.entityId) {
    throw new Error("Missing cashier identity for POS operations");
  }
  return decision.entityId;
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
  const { house, supabase, decision } = await resolveHouse(slug);
  const entityId = requireEntityId(decision);
  const activeShift = await getOpenShiftForUser(
    { houseId: house.id, branchId: house.id, userId: entityId },
    supabase,
  );

  if (!activeShift) {
    throw new Error("Open a shift before recording sales.");
  }

  return createSale(
    {
      houseId: house.id,
      shiftId: activeShift.id,
      cart: input.cart,
      tenders: input.tenders,
      customerId: input.customerId,
      customerName: input.customerName,
    },
    supabase,
  );
}

export async function loadActiveShiftAction(slug: string): Promise<SerializableShift | null> {
  const { house, supabase, decision } = await resolveHouse(slug);
  const entityId = requireEntityId(decision);
  const shift = await getOpenShiftForUser({ houseId: house.id, branchId: house.id, userId: entityId }, supabase);
  return shift ? serializeShift(shift) : null;
}

export async function openShiftAction(slug: string, input: { openingCashCents: number }): Promise<SerializableShift> {
  const { house, supabase, decision } = await resolveHouse(slug);
  const entityId = requireEntityId(decision);
  const shift = await openShift(
    { houseId: house.id, branchId: house.id, userId: entityId, openingCashCents: input.openingCashCents },
    supabase,
  );
  return serializeShift(shift);
}

export async function loadShiftSummaryAction(slug: string, shiftId: string): Promise<SerializableShiftSummary> {
  const { house, supabase, decision } = await resolveHouse(slug);
  requireEntityId(decision);
  const summary = await computeShiftTotals({ shiftId, houseId: house.id }, supabase);
  return serializeSummary(summary);
}

export async function closeShiftAction(
  slug: string,
  input: { shiftId: string; countedCashCents: number },
): Promise<SerializableShiftSummary> {
  const { house, supabase, decision } = await resolveHouse(slug);
  const entityId = requireEntityId(decision);
  const summary = await closeShift(
    { shiftId: input.shiftId, houseId: house.id, userId: entityId, countedCashCents: input.countedCashCents },
    supabase,
  );
  return serializeSummary(summary);
}

export async function listRecentSalesAction(slug: string, limit = 50): Promise<RecentSaleSummary[]> {
  const { house, supabase } = await resolveHouse(slug);
  return listRecentSales(house.id, supabase, { limit });
}

export async function loadSaleReceiptAction(slug: string, saleId: string): Promise<LoadSaleReceiptResult> {
  const { house, supabase } = await resolveHouse(slug);
  return loadSaleReceipt(saleId, house.id, supabase);
}
