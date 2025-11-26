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

import { summarizeCheckout } from "./checkout";
import type { CheckoutInput, SaleSummary } from "./types";

type SaleRepository = {
  insertSale(payload: PosSaleInsert): Promise<PosSaleRow>;
  insertSaleLines(rows: PosSaleLineInsert[]): Promise<void>;
  insertSaleTenders(rows: PosSaleTenderInsert[]): Promise<void>;
};

function resolveSupabaseRepository(client?: SupabaseClient<Database> | null): SaleRepository {
  const supabase = client ?? createServiceSupabaseClient<Database>();

  return {
    async insertSale(payload) {
      const { data, error } = await supabase.from("pos_sales").insert(payload).select().maybeSingle();
      if (error) throw new Error(error.message);
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
      const now = payload.created_at ?? new Date().toISOString();
      const row: PosSaleRow = {
        id: payload.id ?? `sale-${saleCounter++}`,
        house_id: payload.house_id,
        workspace_id: payload.workspace_id ?? null,
        sequence_no: payload.sequence_no ?? null,
        status: payload.status ?? "COMPLETED",
        subtotal_cents: payload.subtotal_cents,
        discount_cents: payload.discount_cents ?? 0,
        total_cents: payload.total_cents,
        amount_received_cents: payload.amount_received_cents,
        change_cents: payload.change_cents,
        outstanding_cents: payload.outstanding_cents,
        customer_name: payload.customer_name ?? null,
        customer_ref: payload.customer_ref ?? null,
        meta: (payload.meta as PosSaleRow["meta"]) ?? null,
        created_at: now,
        created_by: payload.created_by ?? null,
        closed_at: payload.closed_at ?? now,
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
  } satisfies SaleRepository & { sales: PosSaleRow[]; lines: PosSaleLineRow[]; tenders: PosSaleTenderRow[] };
}

function resolveRepository(client?: SupabaseClient<Database> | SaleRepository | null): SaleRepository {
  if (client && typeof (client as SaleRepository).insertSale === "function") {
    return client as SaleRepository;
  }
  return resolveSupabaseRepository(client as SupabaseClient<Database> | null);
}

export async function createSale(input: CheckoutInput, client?: SupabaseClient<Database> | SaleRepository): Promise<SaleSummary> {
  const { cart, tenders, totals, customerName, customerRef, meta } = summarizeCheckout(input);
  const repository = resolveRepository(client);
  const now = new Date().toISOString();

  const saleInsert: PosSaleInsert = {
    house_id: input.houseId,
    workspace_id: null,
    sequence_no: null,
    status: "COMPLETED",
    subtotal_cents: cart.subtotalCents,
    discount_cents: cart.discountCents,
    total_cents: cart.totalCents,
    amount_received_cents: totals.amountReceivedCents,
    change_cents: totals.changeCents,
    outstanding_cents: totals.outstandingCents,
    customer_name: customerName,
    customer_ref: customerRef,
    meta: meta as PosSaleInsert["meta"],
    created_at: now,
    created_by: null,
    closed_at: now,
  };

  const saleRow = await repository.insertSale(saleInsert);

  const lineRows: PosSaleLineInsert[] = cart.lines.map((line) => ({
    sale_id: saleRow.id,
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
    meta: null,
    created_at: now,
    updated_at: now,
  }));

  const tenderRows: PosSaleTenderInsert[] = tenders.map((tender) => ({
    sale_id: saleRow.id,
    house_id: input.houseId,
    tender_type: tender.type,
    amount_cents: tender.amount,
    reference: tender.reference,
    meta: null,
    created_at: now,
    updated_at: now,
  }));

  await repository.insertSaleLines(lineRows);
  await repository.insertSaleTenders(tenderRows);

  return {
    id: saleRow.id,
    totalCents: cart.totalCents,
    changeCents: totals.changeCents,
    outstandingCents: totals.outstandingCents,
    createdAt: saleRow.created_at,
  } satisfies SaleSummary;
}
