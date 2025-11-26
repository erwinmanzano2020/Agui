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

test("cash overpay returns change without outstanding", () => {
  const result = summarizeCheckout({
    houseId,
    cart: sampleCart,
    tenders: [{ type: "CASH", amount: 20000 }],
  });

  assert.equal(result.totals.changeCents, 2000);
  assert.equal(result.totals.outstandingCents, 0);
});

test("mixed non-credit and credit closes out sale", () => {
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
  assert.equal(result.totals.outstandingCents, 0);
});

test("partial credit leaves outstanding balance", () => {
  const result = summarizeCheckout({
    houseId,
    cart: sampleCart,
    tenders: [
      { type: "CASH", amount: 10000 },
      { type: "CREDIT", amount: 3000 },
    ],
    customerName: "Juan",
  });

  assert.equal(result.totals.changeCents, 0);
  assert.equal(result.totals.outstandingCents, 5000);
});

test("credit only exact amount is allowed", () => {
  const result = summarizeCheckout({
    houseId,
    cart: sampleCart,
    tenders: [{ type: "CREDIT", amount: 18000 }],
    customerName: "Ana",
  });

  assert.equal(result.totals.changeCents, 0);
  assert.equal(result.totals.outstandingCents, 0);
});

test("over-credit is rejected", () => {
  assert.throws(
    () =>
      summarizeCheckout({
        houseId,
        cart: sampleCart,
        tenders: [{ type: "CREDIT", amount: 20000 }],
        customerName: "Ana",
      }),
    /Credit amount exceeds remaining balance/,
  );
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

test("credit tender is stored with accurate totals", async () => {
  const repo = createInMemorySaleRepository();
  const summary = await createSale(
    {
      houseId,
      cart: sampleCart,
      tenders: [
        { type: "CASH", amount: 10000 },
        { type: "CREDIT", amount: 3000 },
      ],
      customerName: "Juan",
    },
    repo,
  );

  assert.equal(summary.outstandingCents, 5000);
  const saleRow = repo.sales[0];
  assert.equal(saleRow?.total_cents, 18000);
  assert.equal(saleRow?.amount_received_cents, 10000);
  assert.equal(saleRow?.change_cents, 0);
  assert.equal(saleRow?.outstanding_cents, 5000);
  assert.equal(repo.tenders.find((row) => row.tender_type === "CREDIT")?.amount_cents, 3000);
});

test("over-credit sale is not persisted", async () => {
  const repo = createInMemorySaleRepository();
  await assert.rejects(
    () =>
      createSale(
        {
          houseId,
          cart: sampleCart,
          tenders: [{ type: "CREDIT", amount: 20000 }],
          customerName: "Ana",
        },
        repo,
      ),
    /Credit amount exceeds remaining balance/,
  );
  assert.equal(repo.sales.length, 0);
  assert.equal(repo.tenders.length, 0);
});
