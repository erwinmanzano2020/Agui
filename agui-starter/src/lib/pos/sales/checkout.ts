import {
  type CheckoutInput,
  type CheckoutTotals,
  type SalesCartLineSnapshot,
  type SalesCartSnapshot,
  type TenderInput,
} from "./types";

type NormalizedLine = {
  itemId: string;
  itemName: string;
  uomId: string | null;
  barcode: string | null;
  uomLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  baseUnitPriceCents: number;
  lineTotalCents: number;
  tierTag: string | null;
  specialPricing: SalesCartLineSnapshot["specialPricing"];
};

type NormalizedCart = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  lines: NormalizedLine[];
};

type NormalizedTender = Required<TenderInput> & { reference: string | null };

type CheckoutComputation = {
  cart: NormalizedCart;
  tenders: NormalizedTender[];
  totals: CheckoutTotals;
  customerId: string | null;
  customerName: string | null;
  meta: CheckoutInput["meta"];
};

function ensureNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return value;
}

function ensurePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return value;
}

function ensureString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  return trimmed;
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLine(snapshot: SalesCartLineSnapshot, index: number): NormalizedLine {
  return {
    itemId: ensureString(snapshot.itemId, `line ${index} item id`),
    itemName: ensureString(snapshot.itemName, `line ${index} name`),
    uomId: snapshot.uomId ?? null,
    barcode: snapshot.barcode ?? null,
    uomLabel: snapshot.uomLabel ?? null,
    quantity: ensurePositiveNumber(snapshot.quantity, `line ${index} quantity`),
    unitPriceCents: ensureNonNegativeInteger(snapshot.unitPriceCents, `line ${index} unit price`),
    baseUnitPriceCents: ensureNonNegativeInteger(
      snapshot.baseUnitPriceCents ?? snapshot.unitPriceCents,
      `line ${index} base unit price`,
    ),
    lineTotalCents: ensureNonNegativeInteger(snapshot.lineTotalCents, `line ${index} total`),
    tierTag: snapshot.tierTag ?? null,
    specialPricing: snapshot.specialPricing ?? null,
  } satisfies NormalizedLine;
}

function normalizeCartSnapshot(cart: SalesCartSnapshot): NormalizedCart {
  if (!cart || typeof cart !== "object") {
    throw new Error("Cart snapshot is required");
  }

  const lines = (cart.lines ?? []).map((line, index) => normalizeLine(line, index));
  if (lines.length === 0) {
    throw new Error("Cart is empty");
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const discountCents = ensureNonNegativeInteger(cart.discountCents ?? 0, "discount");
  const totalCents = Math.max(0, subtotalCents - discountCents);

  return { subtotalCents, discountCents, totalCents, lines } satisfies NormalizedCart;
}

function normalizeTender(tender: TenderInput, index: number): NormalizedTender {
  if (!tender || typeof tender !== "object") {
    throw new Error(`Tender ${index + 1} is invalid`);
  }
  const normalizedAmount = ensureNonNegativeInteger(tender.amount, `Tender ${index + 1} amount`);
  if (normalizedAmount <= 0) {
    throw new Error(`Tender ${index + 1} amount must be greater than zero`);
  }

  const type = ensureString(tender.type, `Tender ${index + 1} type`);
  if (!['CASH', 'EWALLET', 'CREDIT'].includes(type)) {
    throw new Error(`Tender ${index + 1} type is not supported`);
  }

  return {
    type: type as TenderInput["type"],
    amount: normalizedAmount,
    reference: tender.reference?.toString().trim() || null,
  } satisfies NormalizedTender;
}

function clampTenderAmount(amount: number): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return 0;
  const rounded = Math.round(amount);
  if (!Number.isSafeInteger(rounded)) return 0;
  return Math.max(0, rounded);
}

export function tallyTenderMath(totalCents: number, tenders: Array<{ type: TenderInput["type"]; amount: number }>): CheckoutTotals {
  const normalizedTotal = clampTenderAmount(totalCents);
  const sumCash = tenders
    .filter((entry) => entry.type === "CASH")
    .reduce((sum, entry) => sum + clampTenderAmount(entry.amount), 0);
  const sumCredit = tenders
    .filter((entry) => entry.type === "CREDIT")
    .reduce((sum, entry) => sum + clampTenderAmount(entry.amount), 0);
  const sumNonCashNonCredit = tenders
    .filter((entry) => entry.type !== "CASH" && entry.type !== "CREDIT")
    .reduce((sum, entry) => sum + clampTenderAmount(entry.amount), 0);

  const amountReceivedCents = sumCash + sumNonCashNonCredit;
  const changeCents = Math.max(0, amountReceivedCents - normalizedTotal);
  const remainingAfterNonCredit = Math.max(0, normalizedTotal - amountReceivedCents);

  if (sumCredit > remainingAfterNonCredit) {
    throw new Error("Credit amount exceeds remaining balance");
  }

  const outstandingCents = Math.max(0, remainingAfterNonCredit - sumCredit);

  return {
    subtotalCents: normalizedTotal,
    discountCents: 0,
    totalCents: normalizedTotal,
    amountReceivedCents,
    changeCents,
    outstandingCents,
    sumCashCents: sumCash,
    sumNonCashNonCreditCents: sumNonCashNonCredit,
    sumCreditCents: sumCredit,
  } satisfies CheckoutTotals;
}

function computeTotals(cart: NormalizedCart, tenders: NormalizedTender[]): CheckoutTotals {
  const totals = tallyTenderMath(cart.totalCents, tenders);
  return { ...totals, subtotalCents: cart.subtotalCents, discountCents: cart.discountCents, totalCents: cart.totalCents };
}

export function summarizeCheckout(input: CheckoutInput): CheckoutComputation {
  if (!input || typeof input !== "object") {
    throw new Error("Checkout input is required");
  }

  const cart = normalizeCartSnapshot(input.cart);
  const tenders = (input.tenders ?? []).map((tender, index) => normalizeTender(tender, index));
  if (tenders.length === 0) {
    throw new Error("At least one tender is required");
  }

  const totals = computeTotals(cart, tenders);

  if (cart.totalCents < 0 || totals.amountReceivedCents < 0) {
    throw new Error("Totals cannot be negative");
  }

  if (totals.outstandingCents < 0 || totals.outstandingCents > totals.totalCents) {
    throw new Error("Outstanding amount is invalid");
  }

  const customerName = toNullableString(input.customerName);
  const customerId = toNullableString(input.customerId);
  const hasCustomer = Boolean(customerId || customerName);
  if (totals.sumCreditCents > 0 && !hasCustomer) {
    throw new Error("Credit requires a customer");
  }

  return {
    cart,
    tenders,
    totals,
    customerId,
    customerName,
    meta: input.meta ?? null,
  } satisfies CheckoutComputation;
}

export function computePreviewTotals(cart: SalesCartSnapshot, tenders: TenderInput[]): CheckoutTotals {
  const subtotal = (cart?.lines ?? []).reduce((sum, line) => sum + clampTenderAmount(line.lineTotalCents), 0);
  const discountCents = clampTenderAmount(cart.discountCents ?? 0);
  const totalCents = Math.max(0, subtotal - discountCents);
  const sanitizedTenders = (tenders ?? []).map((tender) => ({ type: tender.type, amount: clampTenderAmount(tender.amount) }));
  const totals = tallyTenderMath(totalCents, sanitizedTenders);

  return { ...totals, subtotalCents: subtotal, discountCents, totalCents } satisfies CheckoutTotals;
}
