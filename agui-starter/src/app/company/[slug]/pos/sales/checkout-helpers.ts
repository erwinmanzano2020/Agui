import { computePreviewTotals } from "@/lib/pos/sales/checkout";
import type { SalesCartSnapshot, TenderInput } from "@/lib/pos/sales/types";
import type { PosCartState } from "@/lib/pos/sales-cart";

export type TenderFormState = {
  cash: string;
  ewallet: string;
  credit: string;
  ewalletRef: string;
  customerId: string;
  customerName: string;
};

export function centsToInput(amount: number): string {
  return (amount / 100).toFixed(2);
}

export function parseInputToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
  const cents = Math.round(parsed * 100);
  return Math.max(0, cents);
}

export function toCartSnapshot(state: PosCartState): SalesCartSnapshot {
  return {
    subtotalCents: state.subtotal,
    discountCents: 0,
    lines: state.lines.map((line) => ({
      itemId: line.itemId,
      itemName: line.itemName,
      uomId: line.uomId,
      barcode: line.barcode ?? null,
      uomLabel: line.uomLabel ?? null,
      quantity: line.quantity,
      unitPriceCents: line.unitPrice,
      baseUnitPriceCents: line.baseUnitPrice,
      lineTotalCents: line.lineTotal,
      tierTag: line.tierTag,
      specialPricing: line.specialPricing ?? null,
    })),
  } satisfies SalesCartSnapshot;
}

export function buildTenderInputs(form: TenderFormState): TenderInput[] {
  const list: TenderInput[] = [];
  const cashCents = parseInputToCents(form.cash);
  if (cashCents > 0) list.push({ type: "CASH", amount: cashCents });
  const ewalletCents = parseInputToCents(form.ewallet);
  if (ewalletCents > 0) list.push({ type: "EWALLET", amount: ewalletCents, reference: form.ewalletRef || null });
  const creditCents = parseInputToCents(form.credit);
  if (creditCents > 0) list.push({ type: "CREDIT", amount: creditCents });
  return list;
}

export function deriveCheckoutState(cartState: PosCartState, form: TenderFormState) {
  const cartSnapshot = toCartSnapshot(cartState);
  const tenderInputs = buildTenderInputs(form);
  let previewTotals: ReturnType<typeof computePreviewTotals>;
  let validationError: string | null = null;
  try {
    previewTotals = computePreviewTotals(cartSnapshot, tenderInputs);
  } catch (err) {
    validationError = err instanceof Error ? err.message : "Invalid tender amounts";
    const totalCents = cartSnapshot.subtotalCents - (cartSnapshot.discountCents ?? 0);
    previewTotals = {
      subtotalCents: cartSnapshot.subtotalCents,
      discountCents: cartSnapshot.discountCents ?? 0,
      totalCents,
      amountReceivedCents: 0,
      changeCents: 0,
      outstandingCents: Math.max(0, totalCents),
      sumCashCents: 0,
      sumNonCashNonCreditCents: 0,
      sumCreditCents: 0,
    };
  }
  const trimmedCustomer = form.customerName.trim();
  const customerId = form.customerId.trim();
  const requiresCustomer = previewTotals.sumCreditCents > 0;
  const hasCustomer = Boolean(customerId || trimmedCustomer);
  if (!validationError && requiresCustomer && !hasCustomer) {
    validationError = "Credit requires a customer";
  }

  const hasLines = cartState.lines.length > 0;
  const hasOutstandingWithoutCredit = previewTotals.outstandingCents > 0 && previewTotals.sumCreditCents === 0;
  const canConfirm =
    hasLines &&
    tenderInputs.length > 0 &&
    !validationError &&
    (!requiresCustomer || hasCustomer) &&
    previewTotals.outstandingCents >= 0 &&
    !hasOutstandingWithoutCredit;

  return {
    cartSnapshot,
    tenderInputs,
    previewTotals,
    requiresCustomer,
    hasCustomer,
    validationError,
    canConfirm,
    trimmedCustomer,
    trimmedCustomerId: customerId,
  } as const;
}
