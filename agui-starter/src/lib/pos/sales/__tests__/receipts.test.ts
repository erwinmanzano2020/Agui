import assert from "node:assert";
import test from "node:test";

import { createInMemorySaleRepository, createSale, listRecentSales, loadSaleReceipt } from "../server";
import type { CheckoutInput } from "../types";

const baseCart: CheckoutInput["cart"] = {
  subtotalCents: 12000,
  discountCents: 2000,
  lines: [
    {
      itemId: "item-1",
      itemName: "Widget",
      uomId: null,
      barcode: null,
      uomLabel: "pc",
      quantity: 1,
      unitPriceCents: 10000,
      baseUnitPriceCents: 12000,
      lineTotalCents: 10000,
      tierTag: null,
      specialPricing: null,
    },
  ],
};

function buildInput(overrides?: Partial<CheckoutInput>): CheckoutInput {
  return {
    houseId: "house-1",
    cart: baseCart,
    tenders: [{ type: "CASH", amount: 15000 }],
    customerId: "cust-1",
    customerName: "Test Buyer",
    ...overrides,
  } satisfies CheckoutInput;
}

test("createSale returns receipt details with numbering and totals", async () => {
  const repository = createInMemorySaleRepository();
  const first = await createSale(buildInput(), repository);
  const second = await createSale(buildInput(), repository);

  assert.ok(first.receiptNumber.length > 0);
  assert.notEqual(first.receiptNumber, second.receiptNumber);
  assert.equal(first.totalCents, 10000);
  assert.equal(first.discountCents, 2000);
  assert.equal(first.subtotalCents, 12000);
  assert.equal(first.tenders[0]?.type, "CASH");
});

test("recent sales are ordered newest first", async () => {
  const repository = createInMemorySaleRepository();
  const first = await createSale(buildInput(), repository);
  const second = await createSale(buildInput({ cart: { ...baseCart, subtotalCents: 5000, discountCents: 0 } }), repository);

  const recent = await listRecentSales("house-1", repository, { limit: 5 });
  assert.equal(recent[0]?.id, second.id);
  assert.equal(recent[1]?.id, first.id);
});

test("loadSaleReceipt hydrates tenders and outstanding credit", async () => {
  const repository = createInMemorySaleRepository();
  const creditSale = await createSale(
    buildInput({
      cart: { ...baseCart, subtotalCents: 8000, discountCents: 0, lines: [{ ...baseCart.lines[0]!, unitPriceCents: 8000, baseUnitPriceCents: 8000, lineTotalCents: 8000 }] },
      tenders: [{ type: "CREDIT", amount: 5000 }],
    }),
    repository,
  );

  const loaded = await loadSaleReceipt(creditSale.id, repository);
  assert.ok(loaded);
  assert.equal(loaded?.outstandingCents, 3000);
  assert.equal(loaded?.tenders[0]?.type, "CREDIT");
});
