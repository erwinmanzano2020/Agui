import assert from "node:assert";
import test from "node:test";

import { deriveCheckoutState } from "../checkout-helpers";
import type { PosCartState } from "@/lib/pos/sales-cart";

const cartState: PosCartState = {
  lines: [
    {
      id: "line-1",
      itemId: "item-1",
      itemName: "Sample",
      barcode: null,
      uomId: null,
      uomCode: "PC",
      uomLabel: null,
      quantity: 1,
      unitPrice: 18000,
      tierTag: null,
      lineTotal: 18000,
      uoms: [{ id: "uom-1", code: "PC", label: null, factorToBase: 1 }],
    },
  ],
  subtotal: 18000,
  lastLineId: null,
};

function blankForm() {
  return { cash: "", ewallet: "", credit: "", ewalletRef: "", customerName: "" };
}

test("cart totals flow into checkout state", () => {
  const result = deriveCheckoutState(cartState, blankForm());
  assert.equal(result.previewTotals.totalCents, cartState.subtotal);
});

test("mixed tenders compute change and outstanding", () => {
  const result = deriveCheckoutState(cartState, { ...blankForm(), cash: "100", ewallet: "30" });
  assert.equal(result.previewTotals.changeCents, 0);
  assert.equal(result.previewTotals.outstandingCents, 5000);
  assert.equal(result.canConfirm, false);
});

test("credit requires a customer before confirming", () => {
  const creditOnly = deriveCheckoutState(cartState, { ...blankForm(), credit: "180" });
  assert.equal(creditOnly.canConfirm, false);
  assert.equal(creditOnly.validationError, "Please select or enter a customer name for credit sales.");

  const withCustomer = deriveCheckoutState(cartState, { ...blankForm(), credit: "180", customerName: "Ana" });
  assert.equal(withCustomer.canConfirm, true);
});

test("over-credit is flagged and prevents confirmation", () => {
  const result = deriveCheckoutState(cartState, { ...blankForm(), credit: "200" });
  assert.equal(result.validationError, "Credit amount exceeds remaining balance");
  assert.equal(result.canConfirm, false);
});
