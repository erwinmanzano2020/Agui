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
  const result = deriveCheckoutState(cartState, { ...blankForm(), cash: "100", ewallet: "50", credit: "30" });
  assert.equal(result.previewTotals.changeCents, 0);
  assert.equal(result.previewTotals.outstandingCents, 3000);
});

test("credit requires a customer before confirming", () => {
  const creditOnly = deriveCheckoutState(cartState, { ...blankForm(), credit: "180" });
  assert.equal(creditOnly.canConfirm, false);

  const withCustomer = deriveCheckoutState(cartState, { ...blankForm(), credit: "180", customerName: "Ana" });
  assert.equal(withCustomer.canConfirm, true);
});
