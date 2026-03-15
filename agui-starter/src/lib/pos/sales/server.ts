import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  PosSaleInsert,
  PosSaleLineInsert,
  PosSaleLineRow,
  PosSaleRow,
  PosSaleTenderInsert,
  PosSaleTenderRow,
} from "@/lib/db.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  applyInventoryForSale,
  createInMemoryInventoryCatalogRepository,
  createInMemoryStockMovementRepository,
  createSupabaseInventoryCatalogRepository,
  createSupabaseStockMovementRepository,
  type InventoryPostingDependencies,
} from "../inventory/server";

import { summarizeCheckout } from "./checkout";
import type {
  CheckoutInput,
  LoadSaleReceiptResult,
  PosReceiptSale,
  PosReceiptTender,
  RecentSaleSummary,
} from "./types";

type SaleRepository = {
  insertSale(payload: PosSaleInsert): Promise<PosSaleRow>;
  insertSaleLines(rows: PosSaleLineInsert[]): Promise<void>;
  insertSaleTenders(rows: PosSaleTenderInsert[]): Promise<void>;
  getLatestSequenceForHouse(houseId: string): Promise<number | null>;
  getSaleById?(saleId: string, houseId: string): Promise<PosSaleRow | null>;
  listSaleLines?(saleId: string, houseId: string): Promise<PosSaleLineRow[]>;
  listSaleTenders?(saleId: string, houseId: string): Promise<PosSaleTenderRow[]>;
  listRecentSales?(houseId: string, limit: number): Promise<PosSaleRow[]>;
  listTendersForSales?(saleIds: string[]): Promise<PosSaleTenderRow[]>;
};

function forbiddenSaleAccessError() {
  const err = new Error("Forbidden sale access") as Error & { code?: string };
  err.code = "FORBIDDEN_SALE_ACCESS";
  return err;
}

function resolveSupabaseRepository(client?: SupabaseClient<Database> | null): SaleRepository {
  const supabase = client ?? createServiceSupabaseClient<Database>();

  return {
    async insertSale(payload) {
      const { data, error } = await supabase.from("pos_sales").insert(payload).select().maybeSingle();
      if (error) {
        const err = new Error(error.message) as Error & { code?: string };
        err.code = error.code;
        throw err;
      }
      if (!data) throw new Error("Failed to insert sale");
      return data as PosSaleRow;
    },
    async insertSaleLines(rows) {
      if (rows.length === 0) return;
      const { error } = await supabase.from("pos_sale_lines").insert(rows);
      if (error) throw new Error(error.message);
    },
    async insertSaleTenders(rows) {
      if (rows.length === 0) return;
      const { error } = await supabase.from("pos_sale_tenders").insert(rows);
      if (error) throw new Error(error.message);
    },
    async getLatestSequenceForHouse(houseId) {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("sequence_no")
        .eq("house_id", houseId)
        .not("sequence_no", "is", null)
        .order("sequence_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.sequence_no ?? null;
    },
    async getSaleById(saleId, houseId) {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("*")
        .eq("id", saleId)
        .maybeSingle<PosSaleRow>();
      if (error) throw new Error(error.message);
      const saleRow = data ?? null;
      if (!saleRow) return null;
      if (saleRow.house_id !== houseId) throw forbiddenSaleAccessError();
      return saleRow;
    },
    async listSaleLines(saleId, houseId) {
      const { data, error } = await supabase
        .from("pos_sale_lines")
        .select("*")
        .eq("sale_id", saleId)
        .eq("house_id", houseId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data as PosSaleLineRow[]) ?? [];
    },
    async listSaleTenders(saleId, houseId) {
      const { data, error } = await supabase
        .from("pos_sale_tenders")
        .select("*")
        .eq("sale_id", saleId)
        .eq("house_id", houseId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data as PosSaleTenderRow[]) ?? [];
    },
    async listRecentSales(houseId, limit) {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("*")
        .eq("house_id", houseId)
        .order("sequence_no", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data as PosSaleRow[]) ?? [];
    },
    async listTendersForSales(saleIds) {
      if (saleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pos_sale_tenders")
        .select("*")
        .in("sale_id", saleIds);
      if (error) throw new Error(error.message);
      return (data as PosSaleTenderRow[]) ?? [];
    },
  } satisfies SaleRepository;
}

export function createInMemorySaleRepository(initial?: Partial<{
  sales: PosSaleRow[];
  lines: PosSaleLineRow[];
  tenders: PosSaleTenderRow[];
}>): SaleRepository & { sales: PosSaleRow[]; lines: PosSaleLineRow[]; tenders: PosSaleTenderRow[] } {
  let saleCounter = 1;
  let lineCounter = 1;
  let tenderCounter = 1;
  const sales = [...(initial?.sales ?? [])];
  const lines = [...(initial?.lines ?? [])];
  const tenders = [...(initial?.tenders ?? [])];

  return {
    sales,
    lines,
    tenders,
    async insertSale(payload) {
      const hasConflict = sales.some(
        (existing) =>
          existing.house_id === payload.house_id &&
          ((payload.sequence_no != null && existing.sequence_no === payload.sequence_no) ||
            (payload.receipt_number && existing.receipt_number === payload.receipt_number)),
      );
      if (hasConflict) {
        const err = new Error("duplicate key value violates unique constraint") as Error & { code?: string };
        err.code = "23505";
        throw err;
      }
      const now = payload.created_at ?? new Date().toISOString();
      const row: PosSaleRow = {
        id: payload.id ?? `sale-${saleCounter++}`,
        house_id: payload.house_id,
        workspace_id: payload.workspace_id ?? null,
        sequence_no: payload.sequence_no ?? null,
        receipt_number: payload.receipt_number ?? null,
        status: payload.status ?? "COMPLETED",
        subtotal_cents: payload.subtotal_cents,
        discount_cents: payload.discount_cents ?? 0,
        total_cents: payload.total_cents,
        amount_received_cents: payload.amount_received_cents,
        change_cents: payload.change_cents,
        outstanding_cents: payload.outstanding_cents,
        customer_entity_id: payload.customer_entity_id ?? null,
        customer_name: payload.customer_name ?? null,
        customer_ref: payload.customer_ref ?? null,
        meta: (payload.meta as PosSaleRow["meta"]) ?? null,
        created_at: now,
        created_by: payload.created_by ?? null,
        closed_at: payload.closed_at ?? now,
        shift_id: payload.shift_id ?? null,
      };
      sales.push(row);
      return row;
    },
    async insertSaleLines(rows) {
      for (const payload of rows) {
        const now = payload.created_at ?? new Date().toISOString();
        const row: PosSaleLineRow = {
          id: payload.id ?? `line-${lineCounter++}`,
          sale_id: payload.sale_id,
          house_id: payload.house_id,
          item_id: payload.item_id,
          uom_id: payload.uom_id ?? null,
          barcode: payload.barcode ?? null,
          name_snapshot: payload.name_snapshot,
          uom_label_snapshot: payload.uom_label_snapshot ?? null,
          quantity: payload.quantity,
          unit_price_cents: payload.unit_price_cents,
          line_total_cents: payload.line_total_cents,
          tier_applied: payload.tier_applied ?? null,
          meta: (payload.meta as PosSaleLineRow["meta"]) ?? null,
          created_at: now,
          updated_at: payload.updated_at ?? now,
        };
        lines.push(row);
      }
    },
    async insertSaleTenders(rows) {
      for (const payload of rows) {
        const now = payload.created_at ?? new Date().toISOString();
        const row: PosSaleTenderRow = {
          id: payload.id ?? `tender-${tenderCounter++}`,
          sale_id: payload.sale_id,
          house_id: payload.house_id,
          tender_type: payload.tender_type,
          amount_cents: payload.amount_cents,
          reference: payload.reference ?? null,
          meta: (payload.meta as PosSaleTenderRow["meta"]) ?? null,
          created_at: now,
          updated_at: payload.updated_at ?? now,
        };
        tenders.push(row);
      }
    },
    async getLatestSequenceForHouse(houseId) {
      const perHouse = sales.filter((sale) => sale.house_id === houseId && sale.sequence_no != null);
      if (perHouse.length === 0) return null;
      return perHouse.reduce((max, sale) => Math.max(max, sale.sequence_no ?? 0), 0);
    },
    async getSaleById(saleId, houseId) {
      const sale = sales.find((entry) => entry.id === saleId);
      if (!sale) return null;
      if (sale.house_id !== houseId) throw forbiddenSaleAccessError();
      return sale;
    },
    async listSaleLines(saleId, houseId) {
      return lines.filter((line) => line.sale_id === saleId && line.house_id === houseId);
    },
    async listSaleTenders(saleId, houseId) {
      return tenders.filter((tender) => tender.sale_id === saleId && tender.house_id === houseId);
    },
    async listRecentSales(houseId, limit) {
      return sales
        .filter((sale) => sale.house_id === houseId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },
    async listTendersForSales(saleIds) {
      return tenders.filter((tender) => saleIds.includes(tender.sale_id));
    },
  } satisfies SaleRepository & { sales: PosSaleRow[]; lines: PosSaleLineRow[]; tenders: PosSaleTenderRow[] };
}

function resolveRepository(client?: SupabaseClient<Database> | SaleRepository | null): SaleRepository {
  if (client && typeof (client as SaleRepository).insertSale === "function") {
    return client as SaleRepository;
  }
  return resolveSupabaseRepository(client as SupabaseClient<Database> | null);
}

function resolveInventoryDependencies(
  client: SupabaseClient<Database> | SaleRepository | null | undefined,
  override?: InventoryPostingDependencies,
): InventoryPostingDependencies {
  if (override) return override;

  if (client && typeof (client as SaleRepository).insertSale === "function") {
    return {
      catalog: createInMemoryInventoryCatalogRepository(),
      movements: createInMemoryStockMovementRepository(),
    } satisfies InventoryPostingDependencies;
  }

  const supabase = client && typeof (client as SupabaseClient<Database>).from === "function"
    ? (client as SupabaseClient<Database>)
    : null;

  return {
    catalog: createSupabaseInventoryCatalogRepository(supabase),
    movements: createSupabaseStockMovementRepository(supabase),
  } satisfies InventoryPostingDependencies;
}

function formatReceiptNumber(sequence: number, now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const paddedSeq = String(sequence).padStart(4, "0");
  return `${year}${month}${day}-${hour}-${paddedSeq}`;
}

function mapTenderToReceipt(
  tender: {
    type?: PosSaleTenderRow["tender_type"];
    tender_type?: PosSaleTenderRow["tender_type"];
    amount_cents?: number;
    amount?: number;
    reference?: string | null;
  },
  customerName: string | null,
): PosReceiptTender {
  const type = (tender.tender_type ?? tender.type) as PosSaleTenderRow["tender_type"];
  const amount = tender.amount_cents ?? tender.amount ?? 0;

  if (type === "CASH") {
    return { type: "CASH", amountCents: amount, label: "Cash" } satisfies PosReceiptTender;
  }

  if (type === "CREDIT") {
    const label = customerName ? `Credit (${customerName})` : "Credit";
    return { type: "CREDIT", amountCents: amount, label } satisfies PosReceiptTender;
  }

  const label = tender.reference ? `Non-cash (${tender.reference})` : "Non-cash";
  return { type: "NON_CASH", amountCents: amount, label } satisfies PosReceiptTender;
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string })?.code === "23505" || (error as Error)?.message.includes("duplicate key") === true;
}

export async function createSale(
  input: CheckoutInput,
  client?: SupabaseClient<Database> | SaleRepository,
  inventoryDeps?: InventoryPostingDependencies,
): Promise<PosReceiptSale> {
  const { cart, tenders, totals, customerId, customerName, meta } = summarizeCheckout(input);
  const repository = resolveRepository(client);
  const now = new Date();
  const nowIso = now.toISOString();

  const baseInsert: PosSaleInsert = {
    house_id: input.houseId,
    workspace_id: null,
    status: "COMPLETED",
    subtotal_cents: cart.subtotalCents,
    discount_cents: cart.discountCents,
    total_cents: cart.totalCents,
    amount_received_cents: totals.amountReceivedCents,
    change_cents: totals.changeCents,
    outstanding_cents: totals.outstandingCents,
    customer_entity_id: customerId,
    customer_name: customerName,
    meta: meta as PosSaleInsert["meta"],
    created_at: nowIso,
    created_by: null,
    closed_at: nowIso,
    shift_id: input.shiftId,
  };

  let saleRow: PosSaleRow | null = null;
  let nextSequence = (await repository.getLatestSequenceForHouse(input.houseId)) ?? 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sequence = nextSequence + 1;
    const receiptNumber = formatReceiptNumber(sequence, now);
    try {
      saleRow = await repository.insertSale({ ...baseInsert, sequence_no: sequence, receipt_number: receiptNumber });
      break;
    } catch (error) {
      if (isUniqueViolation(error)) {
        nextSequence = sequence;
        continue;
      }
      throw error;
    }
  }

  if (!saleRow) {
    throw new Error("Unable to finalize sale");
  }

  const lineRows: PosSaleLineInsert[] = cart.lines.map((line) => ({
    id: randomUUID(),
    sale_id: saleRow!.id,
    house_id: input.houseId,
    item_id: line.itemId,
    uom_id: line.uomId,
    barcode: line.barcode,
    name_snapshot: line.itemName,
    uom_label_snapshot: line.uomLabel,
    quantity: line.quantity,
    unit_price_cents: line.unitPriceCents,
    line_total_cents: line.lineTotalCents,
    tier_applied: line.tierTag,
    meta: { base_unit_price_cents: line.baseUnitPriceCents, savings_per_unit_cents: line.savingsPerUnitCents },
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const tenderRows: PosSaleTenderInsert[] = tenders.map((tender) => ({
    sale_id: saleRow!.id,
    house_id: input.houseId,
    tender_type: tender.type,
    amount_cents: tender.amount,
    reference: tender.reference,
    meta: null,
    created_at: nowIso,
    updated_at: nowIso,
  }));

  await repository.insertSaleLines(lineRows);
  await repository.insertSaleTenders(tenderRows);

  const saleLineRows: PosSaleLineRow[] = lineRows.map(
    (line) =>
      ({
        ...line,
        id: line.id!,
        barcode: line.barcode ?? null,
        uom_id: line.uom_id ?? null,
        uom_label_snapshot: line.uom_label_snapshot ?? null,
        tier_applied: line.tier_applied ?? null,
        meta: (line.meta as PosSaleLineRow["meta"]) ?? null,
        created_at: line.created_at ?? nowIso,
        updated_at: line.updated_at ?? nowIso,
      } satisfies PosSaleLineRow),
  );

  const inventory = resolveInventoryDependencies(client ?? null, inventoryDeps);
  let inventoryWarning: string | null = null;
  try {
    await applyInventoryForSale(saleRow, saleLineRows, inventory);
  } catch (error) {
    console.error("Failed to post inventory", error);
    inventoryWarning = error instanceof Error ? error.message : "Inventory posting failed";
  }

  const receiptTenders = tenderRows.map((tender) => mapTenderToReceipt(tender, customerName ?? null));

  return {
    id: saleRow.id,
    receiptNumber: saleRow.receipt_number ?? formatReceiptNumber(saleRow.sequence_no ?? nextSequence + 1, now),
    totalCents: cart.totalCents,
    subtotalCents: cart.subtotalCents,
    discountCents: cart.discountCents,
    changeCents: totals.changeCents,
    outstandingCents: totals.outstandingCents,
    createdAt: saleRow.created_at,
    customerId: saleRow.customer_entity_id,
    customerName: saleRow.customer_name,
    lines: cart.lines.map((line) => ({
      name: line.itemName,
      uomLabel: line.uomLabel,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      savingsPerUnitCents: line.savingsPerUnitCents > 0 ? line.savingsPerUnitCents : undefined,
      tierTag: line.tierTag,
    })),
    tenders: receiptTenders,
    inventoryWarning,
  } satisfies PosReceiptSale;
}

function toReceiptLine(line: PosSaleLineRow) {
  const meta = (line.meta ?? {}) as { base_unit_price_cents?: number; savings_per_unit_cents?: number };
  const savingsPerUnit = typeof meta.savings_per_unit_cents === "number" ? meta.savings_per_unit_cents : 0;
  return {
    name: line.name_snapshot,
    uomLabel: line.uom_label_snapshot,
    quantity: Number(line.quantity),
    unitPriceCents: line.unit_price_cents,
    lineTotalCents: line.line_total_cents,
    savingsPerUnitCents: savingsPerUnit > 0 ? savingsPerUnit : undefined,
    tierTag: line.tier_applied,
  };
}

function toReceiptSale(row: PosSaleRow, lines: PosSaleLineRow[], tenders: PosSaleTenderRow[]): PosReceiptSale {
  const customerName = row.customer_name ?? null;
  return {
    id: row.id,
    receiptNumber: row.receipt_number ?? formatReceiptNumber(row.sequence_no ?? 0, new Date(row.created_at)),
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    changeCents: row.change_cents,
    outstandingCents: row.outstanding_cents,
    createdAt: row.created_at,
    customerId: row.customer_entity_id ?? null,
    customerName,
    lines: lines.map(toReceiptLine),
    tenders: tenders.map((tender) => mapTenderToReceipt(tender, customerName)),
  } satisfies PosReceiptSale;
}

function summarizeTenderTypes(tenders: PosSaleTenderRow[]): Map<string, { hasCash: boolean; hasCredit: boolean; types: Set<string> }> {
  const summary = new Map<string, { hasCash: boolean; hasCredit: boolean; types: Set<string> }>();
  for (const tender of tenders) {
    const entry = summary.get(tender.sale_id) ?? { hasCash: false, hasCredit: false, types: new Set<string>() };
    entry.hasCash = entry.hasCash || tender.tender_type === "CASH";
    entry.hasCredit = entry.hasCredit || tender.tender_type === "CREDIT";
    entry.types.add(tender.tender_type);
    summary.set(tender.sale_id, entry);
  }
  return summary;
}

export async function listRecentSales(
  houseId: string,
  client: SupabaseClient<Database> | SaleRepository | null = null,
  { limit = 50 }: { limit?: number } = {},
): Promise<RecentSaleSummary[]> {
  const repository = resolveRepository(client);
  if (!repository.listRecentSales) {
    return [];
  }

  const sales = await repository.listRecentSales(houseId, limit);
  const sortedSales = [...sales].sort((a, b) => {
    const seqDiff = (b.sequence_no ?? 0) - (a.sequence_no ?? 0);
    if (seqDiff !== 0) return seqDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const saleIds = sortedSales.map((sale) => sale.id);
  let tenderRows: PosSaleTenderRow[] = [];

  if (repository.listTendersForSales) {
    tenderRows = await repository.listTendersForSales(saleIds);
  } else if (repository.listSaleTenders) {
    for (const saleId of saleIds) {
      const rows = await repository.listSaleTenders(saleId, houseId);
      tenderRows.push(...rows);
    }
  }

  const tenderSummary = summarizeTenderTypes(tenderRows);

  return sortedSales.map((sale) => {
    const summary = tenderSummary.get(sale.id) ?? { hasCash: false, hasCredit: false, types: new Set<string>() };
    let tenderLabel: "CASH" | "MIXED" | "CREDIT" = "CASH";
    if (summary.hasCredit || sale.outstanding_cents > 0) {
      tenderLabel = summary.types.size === 1 && summary.hasCredit ? "CREDIT" : "MIXED";
    } else if (summary.types.size > 1 || (summary.types.size === 1 && !summary.hasCash)) {
      tenderLabel = "MIXED";
    }

    return {
      id: sale.id,
      receiptNumber: sale.receipt_number,
      createdAt: sale.created_at,
      totalCents: sale.total_cents,
      customerName: sale.customer_name ?? null,
      tenderSummary: tenderLabel,
    } satisfies RecentSaleSummary;
  });
}

export async function loadSaleReceipt(
  saleId: string,
  houseId: string,
  client: SupabaseClient<Database> | SaleRepository | null = null,
): Promise<LoadSaleReceiptResult> {
  const repository = resolveRepository(client);
  if (!repository.getSaleById || !repository.listSaleLines || !repository.listSaleTenders) {
    return { ok: false, error: "NOT_FOUND" };
  }

  let saleRow: PosSaleRow | null = null;
  try {
    saleRow = await repository.getSaleById(saleId, houseId);
  } catch (error) {
    if ((error as { code?: string })?.code === "FORBIDDEN_SALE_ACCESS") {
      return { ok: false, error: "FORBIDDEN" };
    }
    throw error;
  }

  if (!saleRow) return { ok: false, error: "NOT_FOUND" };

  const [lines, tenders] = await Promise.all([
    repository.listSaleLines(saleId, houseId),
    repository.listSaleTenders(saleId, houseId),
  ]);

  return { ok: true, sale: toReceiptSale(saleRow, lines, tenders) };
}
