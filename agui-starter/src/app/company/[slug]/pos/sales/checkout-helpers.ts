import { computePreviewTotals } from "@/lib/pos/sales/checkout";
import type { SalesCartSnapshot, TenderInput } from "@/lib/pos/sales/types";
import type { PosCartState } from "@/lib/pos/sales-cart";

export type TenderFormState = {
  cash: string;
  ewallet: string;
  credit: string;
  ewalletRef: string;
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
      lineTotalCents: line.lineTotal,
      tierTag: line.tierTag,
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
  const previewTotals = computePreviewTotals(cartSnapshot, tenderInputs);
  const requiresCustomer = previewTotals.outstandingCents > 0;
  const creditAmount = tenderInputs.find((entry) => entry.type === "CREDIT")?.amount ?? 0;
  const creditMismatch = requiresCustomer && previewTotals.outstandingCents !== creditAmount;
  const hasLines = cartState.lines.length > 0;
  const trimmedCustomer = form.customerName.trim();
  const canConfirm =
    hasLines &&
    tenderInputs.length > 0 &&
    !creditMismatch &&
    (!requiresCustomer || Boolean(trimmedCustomer)) &&
    previewTotals.outstandingCents >= 0;

  return {
    cartSnapshot,
    tenderInputs,
    previewTotals,
    requiresCustomer,
    creditMismatch,
    canConfirm,
    trimmedCustomer,
  } as const;
}
