import assert from "node:assert";
import test from "node:test";

import { computePreviewTotals, summarizeCheckout } from "../checkout";
import { createInMemorySaleRepository, createSale } from "../server";
import type { SalesCartSnapshot } from "../types";

const sampleCart: SalesCartSnapshot = {
  subtotalCents: 18000,
  lines: [
    {
      itemId: "item-1",
      itemName: "Sample",
      uomId: null,
      barcode: null,
      uomLabel: null,
      quantity: 1,
      unitPriceCents: 18000,
      lineTotalCents: 18000,
      tierTag: null,
    },
  ],
};

const houseId = "house-1";

test("mixed cash, e-wallet, and credit computes outstanding", () => {
  const result = summarizeCheckout({
    houseId,
    cart: sampleCart,
    tenders: [
      { type: "CASH", amount: 10000 },
      { type: "EWALLET", amount: 5000 },
      { type: "CREDIT", amount: 3000 },
    ],
    customerName: "Maria",
  });

  assert.equal(result.totals.changeCents, 0);
  assert.equal(result.totals.outstandingCents, 3000);
  assert.equal(result.totals.sumCreditCents, 3000);
});

test("pure cash returns change", () => {
  const result = summarizeCheckout({
    houseId,
    cart: sampleCart,
    tenders: [{ type: "CASH", amount: 20000 }],
  });

  assert.equal(result.totals.changeCents, 2000);
  assert.equal(result.totals.outstandingCents, 0);
});

test("non-cash without credit closes sale", () => {
  const result = summarizeCheckout({
    houseId,
    cart: sampleCart,
    tenders: [{ type: "EWALLET", amount: 18000 }],
  });

  assert.equal(result.totals.changeCents, 0);
  assert.equal(result.totals.outstandingCents, 0);
});

test("missing tenders is rejected", () => {
  assert.throws(
    () =>
      summarizeCheckout({
        houseId,
        cart: sampleCart,
        tenders: [],
      }),
    /At least one tender is required/,
  );
});

test("negative tender is rejected", () => {
  assert.throws(
    () =>
      summarizeCheckout({
        houseId,
        cart: sampleCart,
        tenders: [{ type: "CASH", amount: -1 }],
      }),
    /non-negative integer/,
  );
});

test("preview totals tolerate empty tenders", () => {
  const preview = computePreviewTotals(sampleCart, []);
  assert.equal(preview.totalCents, 18000);
  assert.equal(preview.amountReceivedCents, 0);
  assert.equal(preview.outstandingCents, 18000);
});

test("createSale persists rows via in-memory repository", async () => {
  const repo = createInMemorySaleRepository();
  const summary = await createSale(
    {
      houseId,
      cart: sampleCart,
      tenders: [{ type: "CASH", amount: 18000 }],
    },
    repo,
  );

  assert.ok(summary.id);
  assert.equal(repo.sales.length, 1);
  assert.equal(repo.lines.length, sampleCart.lines.length);
  assert.equal(repo.tenders.length, 1);
  assert.equal(repo.sales[0]?.total_cents, 18000);
  assert.equal(repo.tenders[0]?.amount_cents, 18000);
});

test("credit tender is stored as outstanding balance", async () => {
  const repo = createInMemorySaleRepository();
  const summary = await createSale(
    {
      houseId,
      cart: sampleCart,
      tenders: [
        { type: "CASH", amount: 5000 },
        { type: "CREDIT", amount: 13000 },
      ],
      customerName: "Juan",
    },
    repo,
  );

  assert.equal(summary.outstandingCents, 13000);
  assert.equal(repo.tenders.find((row) => row.tender_type === "CREDIT")?.amount_cents, 13000);
});
