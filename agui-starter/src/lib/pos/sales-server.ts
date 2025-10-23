import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";

import { multiplyCentavos } from "./price";

export type PosSaleStatus = "OPEN" | "HELD" | "COMPLETED" | "VOID";

export type PosSale = {
  id: string;
  companyId: string;
  deviceId: string;
  status: PosSaleStatus;
  grandTotal: number;
  seqNo: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PosSaleLine = {
  id: string;
  saleId: string;
  itemId: string;
  sku: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type PosSalePayment = {
  id: string;
  saleId: string;
  paymentType: string;
  amount: number;
  externalReference: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PosSaleHold = {
  id: string;
  saleId: string;
  holdToken: string;
  reason: string | null;
  holdDeviceId: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type SaleLineInput = {
  itemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
  sku?: string | null;
  description?: string | null;
  position?: number;
};

export type SalePaymentInput = {
  paymentType: string;
  amount: number;
  externalReference?: string | null;
  receivedAt?: string | Date | null;
};

export type HoldSaleOptions = {
  supabase?: SupabaseClient | null;
  companyId: string;
  deviceId: string;
  seqNo?: number;
  version?: number;
  grandTotal?: number;
  lines?: SaleLineInput[];
  payments?: SalePaymentInput[];
  holdReason?: string | null;
  holdDeviceId?: string | null;
  expiresAt?: string | Date | null;
  holdToken?: string;
};

export type HoldSaleResult = {
  sale: PosSale;
  holdToken: string;
  hold: PosSaleHold;
};

export type ResumeSaleOptions = {
  supabase?: SupabaseClient | null;
  holdToken: string;
};

export type ResumeSaleResult = {
  sale: PosSale;
  lines: PosSaleLine[];
  payments: PosSalePayment[];
  hold: PosSaleHold;
};

const SALE_STATUSES: Set<PosSaleStatus> = new Set(["OPEN", "HELD", "COMPLETED", "VOID"]);

function resolveSupabaseClient(explicit?: SupabaseClient | null): SupabaseClient {
  if (explicit) return explicit;
  const client = getSupabase();
  if (!client) {
    throw new Error(
      "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return client;
}

function ensureString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  return trimmed;
}

function ensureOptionalString(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string when provided`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureOptionalUuid(value: unknown, label: string): string | null {
  const trimmed = ensureOptionalString(value, label);
  if (!trimmed) return null;
  return trimmed;
}

function ensureStatus(value: unknown, label: string): PosSaleStatus {
  if (typeof value !== "string" || !SALE_STATUSES.has(value as PosSaleStatus)) {
    throw new Error(`${label} must be a valid sale status`);
  }
  return value as PosSaleStatus;
}

function ensureNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return value;
}

function ensurePositiveInteger(value: unknown, label: string): number {
  const coerced = ensureNonNegativeInteger(value, label);
  if (coerced <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  return coerced;
}

function ensureCentavos(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of centavos`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return value;
}

function ensureTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  if (Number.isNaN(Date.parse(trimmed))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return trimmed;
}

function normalizeOptionalDate(value: string | Date | null | undefined, label: string): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) {
      throw new Error(`${label} is not a valid date`);
    }
    return value.toISOString();
  }
  const trimmed = value.toString().trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`${label} is not a valid date`);
  }
  return parsed.toISOString();
}

function generateHoldToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `hold_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

type PreparedLine = {
  sale_id: string;
  item_id: string;
  sku: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  position: number;
};

type PreparedPayment = {
  sale_id: string;
  payment_type: string;
  amount: number;
  external_reference: string | null;
  received_at: string | null;
};

function prepareLines(saleId: string, lines: SaleLineInput[] | undefined): { rows: PreparedLine[]; total: number } {
  if (!lines || lines.length === 0) {
    return { rows: [], total: 0 };
  }

  const rows: PreparedLine[] = [];
  let total = 0;
  lines.forEach((line, index) => {
    const itemId = ensureString(line.itemId, `itemId for line ${index}`);
    const quantity = ensurePositiveInteger(line.quantity, `quantity for line ${index}`);
    const unitPrice = ensureCentavos(line.unitPrice, `unitPrice for line ${index}`);
    const computedTotal = multiplyCentavos(unitPrice, quantity);
    const explicitTotal = line.lineTotal == null ? computedTotal : ensureCentavos(line.lineTotal, `lineTotal for line ${index}`);
    if (explicitTotal !== computedTotal) {
      throw new Error(`lineTotal for line ${index} must equal quantity × unitPrice`);
    }
    total += computedTotal;
    rows.push({
      sale_id: saleId,
      item_id: itemId,
      sku: ensureOptionalString(line.sku ?? null, `sku for line ${index}`),
      description: ensureOptionalString(line.description ?? null, `description for line ${index}`),
      quantity,
      unit_price: unitPrice,
      line_total: computedTotal,
      position: line.position == null ? index : ensureNonNegativeInteger(line.position, `position for line ${index}`),
    });
  });

  if (!Number.isSafeInteger(total)) {
    throw new Error("Sum of line totals exceeds the safe integer range");
  }

  return { rows, total };
}

function preparePayments(saleId: string, payments: SalePaymentInput[] | undefined): PreparedPayment[] {
  if (!payments || payments.length === 0) {
    return [];
  }

  return payments.map((payment, index) => {
    const paymentType = ensureString(payment.paymentType, `paymentType for payment ${index}`);
    const amount = ensureCentavos(payment.amount, `amount for payment ${index}`);
    const externalReference = ensureOptionalString(payment.externalReference ?? null, `externalReference for payment ${index}`);
    const receivedAt = normalizeOptionalDate(payment.receivedAt ?? null, `receivedAt for payment ${index}`);

    return {
      sale_id: saleId,
      payment_type: paymentType,
      amount,
      external_reference: externalReference,
      received_at: receivedAt,
    } satisfies PreparedPayment;
  });
}

function parseSale(row: Record<string, unknown>): PosSale {
  return {
    id: ensureString(row.id, "sale id"),
    companyId: ensureString(row.company_id, "sale company_id"),
    deviceId: ensureString(row.device_id, "sale device_id"),
    status: ensureStatus(row.status, "sale status"),
    grandTotal: ensureCentavos(row.grand_total, "sale grand_total"),
    seqNo: ensureNonNegativeInteger(row.seq_no, "sale seq_no"),
    version: ensurePositiveInteger(row.version, "sale version"),
    createdAt: ensureTimestamp(row.created_at, "sale created_at"),
    updatedAt: ensureTimestamp(row.updated_at, "sale updated_at"),
  } satisfies PosSale;
}

function parseSaleLine(row: Record<string, unknown>): PosSaleLine {
  return {
    id: ensureString(row.id, "sale line id"),
    saleId: ensureString(row.sale_id, "sale line sale_id"),
    itemId: ensureString(row.item_id, "sale line item_id"),
    sku: ensureOptionalString(row.sku ?? null, "sale line sku"),
    description: ensureOptionalString(row.description ?? null, "sale line description"),
    quantity: ensurePositiveInteger(row.quantity, "sale line quantity"),
    unitPrice: ensureCentavos(row.unit_price, "sale line unit_price"),
    lineTotal: ensureCentavos(row.line_total, "sale line line_total"),
    position: ensureNonNegativeInteger(row.position ?? 0, "sale line position"),
    createdAt: ensureTimestamp(row.created_at, "sale line created_at"),
    updatedAt: ensureTimestamp(row.updated_at, "sale line updated_at"),
  } satisfies PosSaleLine;
}

function parseSalePayment(row: Record<string, unknown>): PosSalePayment {
  return {
    id: ensureString(row.id, "sale payment id"),
    saleId: ensureString(row.sale_id, "sale payment sale_id"),
    paymentType: ensureString(row.payment_type, "sale payment type"),
    amount: ensureCentavos(row.amount, "sale payment amount"),
    externalReference: ensureOptionalString(row.external_reference ?? null, "sale payment external_reference"),
    receivedAt: ensureOptionalString(row.received_at ?? null, "sale payment received_at"),
    createdAt: ensureTimestamp(row.created_at, "sale payment created_at"),
    updatedAt: ensureTimestamp(row.updated_at, "sale payment updated_at"),
  } satisfies PosSalePayment;
}

function parseSaleHold(row: Record<string, unknown>): PosSaleHold {
  return {
    id: ensureString(row.id, "sale hold id"),
    saleId: ensureString(row.sale_id, "sale hold sale_id"),
    holdToken: ensureString(row.hold_token, "sale hold token"),
    reason: ensureOptionalString(row.reason ?? null, "sale hold reason"),
    holdDeviceId: ensureOptionalUuid(row.hold_device_id ?? null, "sale hold device"),
    expiresAt: ensureOptionalString(row.expires_at ?? null, "sale hold expires_at"),
    createdAt: ensureTimestamp(row.created_at, "sale hold created_at"),
  } satisfies PosSaleHold;
}

export async function holdSale(options: HoldSaleOptions): Promise<HoldSaleResult> {
  const client = resolveSupabaseClient(options.supabase ?? null);
  const companyId = ensureString(options.companyId, "companyId");
  const deviceId = ensureString(options.deviceId, "deviceId");
  const seqNo = options.seqNo == null ? 0 : ensureNonNegativeInteger(options.seqNo, "seqNo");
  const version = options.version == null ? 1 : ensurePositiveInteger(options.version, "version");

  const { data: insertedSale, error: saleError } = await client
    .from("sales")
    .insert({
      company_id: companyId,
      device_id: deviceId,
      status: "HELD",
      grand_total: 0,
      seq_no: seqNo,
      version,
    })
    .select("*")
    .single();

  if (saleError) {
    throw new Error(`Failed to create sale: ${saleError.message}`);
  }
  if (!insertedSale) {
    throw new Error("Failed to create sale: missing response");
  }

  const sale = parseSale(insertedSale as Record<string, unknown>);
  const saleId = sale.id;

  try {
    const { rows: lineRows, total } = prepareLines(saleId, options.lines);
    const paymentRows = preparePayments(saleId, options.payments);
    const explicitGrandTotal = options.grandTotal == null ? null : ensureCentavos(options.grandTotal, "grandTotal");
    const computedGrandTotal = lineRows.length > 0 ? total : explicitGrandTotal ?? 0;

    if (lineRows.length > 0 && explicitGrandTotal != null && explicitGrandTotal !== total) {
      throw new Error("grandTotal must equal the sum of line totals");
    }

    if (lineRows.length > 0) {
      const { error: linesError } = await client.from("sale_lines").insert(lineRows);
      if (linesError) {
        throw new Error(`Failed to record sale lines: ${linesError.message}`);
      }
    }

    if (paymentRows.length > 0) {
      const { error: paymentsError } = await client.from("sale_payments").insert(paymentRows);
      if (paymentsError) {
        throw new Error(`Failed to record sale payments: ${paymentsError.message}`);
      }
    }

    const { data: updatedSale, error: updateSaleError } = await client
      .from("sales")
      .update({ grand_total: computedGrandTotal })
      .eq("id", saleId)
      .select("*")
      .single();

    if (updateSaleError) {
      throw new Error(`Failed to update sale total: ${updateSaleError.message}`);
    }
    if (!updatedSale) {
      throw new Error("Failed to update sale total");
    }

    const holdToken = options.holdToken ? ensureString(options.holdToken, "holdToken") : generateHoldToken();
    const { data: holdRow, error: holdError } = await client
      .from("sale_holds")
      .insert({
        sale_id: saleId,
        hold_token: holdToken,
        reason: ensureOptionalString(options.holdReason ?? null, "holdReason"),
        hold_device_id: ensureOptionalUuid(options.holdDeviceId ?? null, "holdDeviceId"),
        expires_at: normalizeOptionalDate(options.expiresAt ?? null, "expiresAt"),
      })
      .select("*")
      .single();

    if (holdError) {
      throw new Error(`Failed to record sale hold: ${holdError.message}`);
    }
    if (!holdRow) {
      throw new Error("Failed to record sale hold");
    }

    const refreshedSale = parseSale(updatedSale as Record<string, unknown>);
    const hold = parseSaleHold(holdRow as Record<string, unknown>);

    return { sale: refreshedSale, holdToken: hold.holdToken, hold };
  } catch (error) {
    await client.from("sale_holds").delete().eq("sale_id", saleId);
    await client.from("sale_payments").delete().eq("sale_id", saleId);
    await client.from("sale_lines").delete().eq("sale_id", saleId);
    await client.from("sales").delete().eq("id", saleId);
    throw error;
  }
}

export async function resumeSale(options: ResumeSaleOptions): Promise<ResumeSaleResult> {
  const client = resolveSupabaseClient(options.supabase ?? null);
  const holdToken = ensureString(options.holdToken, "holdToken");

  const { data: holdRow, error: holdLookupError } = await client
    .from("sale_holds")
    .select("*, sale:sales(*, lines:sale_lines(*), payments:sale_payments(*))")
    .eq("hold_token", holdToken)
    .maybeSingle();

  if (holdLookupError) {
    throw new Error(`Failed to load held sale: ${holdLookupError.message}`);
  }
  if (!holdRow) {
    throw new Error("Hold token not found or already resumed");
  }

  const saleRow = (holdRow as { sale?: Record<string, unknown> | null }).sale ?? null;
  if (!saleRow) {
    throw new Error("Held sale is missing the sale record");
  }

  const saleId = ensureString(saleRow.id, "held sale id");

  const rawLines = (saleRow as { lines?: unknown }).lines;
  const linesRaw = Array.isArray(rawLines)
    ? (rawLines as Record<string, unknown>[])
    : [];
  const rawPayments = (saleRow as { payments?: unknown }).payments;
  const paymentsRaw = Array.isArray(rawPayments)
    ? (rawPayments as Record<string, unknown>[])
    : [];

  const nextVersion =
    ensurePositiveInteger(((saleRow as { version?: unknown }).version as number | undefined) ?? 1, "sale version") + 1;

  const { data: updatedSale, error: updateSaleError } = await client
    .from("sales")
    .update({ status: "OPEN", version: nextVersion })
    .eq("id", saleId)
    .select("*")
    .single();

  if (updateSaleError) {
    throw new Error(`Failed to reopen sale: ${updateSaleError.message}`);
  }
  if (!updatedSale) {
    throw new Error("Failed to reopen sale");
  }

  const { error: deleteHoldError } = await client.from("sale_holds").delete().eq("id", holdRow.id);
  if (deleteHoldError) {
    throw new Error(`Failed to clear hold token: ${deleteHoldError.message}`);
  }

  const sale = parseSale(updatedSale as Record<string, unknown>);
  const lines = linesRaw.map((row) => parseSaleLine(row));
  const payments = paymentsRaw.map((row) => parseSalePayment(row));
  const hold = parseSaleHold(holdRow as Record<string, unknown>);

  return { sale, lines, payments, hold };
}
