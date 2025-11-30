import assert from "node:assert";
import test from "node:test";

import type { PosSaleRow } from "@/lib/db.types";
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

  const loaded = await loadSaleReceipt(creditSale.id, "house-1", repository);
  assert.ok(loaded.ok);
  if (!loaded.ok) throw new Error("expected receipt");
  assert.equal(loaded.sale.outstandingCents, 3000);
  assert.equal(loaded.sale.tenders[0]?.type, "CREDIT");
});

test("receipt loading enforces house isolation", async () => {
  const repository = createInMemorySaleRepository();
  const otherHouseSale = await createSale(buildInput({ houseId: "house-2" }), repository);

  const result = await loadSaleReceipt(otherHouseSale.id, "house-1", repository);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "FORBIDDEN");
  }
});

test("loadSaleReceipt passes house to repository helpers", async () => {
  const calls: Array<{ method: string; saleId: string; houseId: string }> = [];
  const saleRow: PosSaleRow = {
    id: "sale-1",
    house_id: "house-1",
    workspace_id: null,
    sequence_no: null,
    receipt_number: null,
    status: "COMPLETED",
    subtotal_cents: 0,
    discount_cents: 0,
    total_cents: 0,
    amount_received_cents: 0,
    change_cents: 0,
    outstanding_cents: 0,
    customer_entity_id: null,
    customer_name: null,
    customer_ref: null,
    meta: null,
    created_at: new Date().toISOString(),
    created_by: null,
    closed_at: null,
  };
  const repository: Parameters<typeof loadSaleReceipt>[2] = {
    insertSale: async () => saleRow,
    insertSaleLines: async () => {},
    insertSaleTenders: async () => {},
    getLatestSequenceForHouse: async () => 0,
    getSaleById: async (saleId: string, houseId: string) => {
      calls.push({ method: "getSaleById", saleId, houseId });
      return saleRow;
    },
    listSaleLines: async (saleId: string, houseId: string) => {
      calls.push({ method: "listSaleLines", saleId, houseId });
      return [];
    },
    listSaleTenders: async (saleId: string, houseId: string) => {
      calls.push({ method: "listSaleTenders", saleId, houseId });
      return [];
    },
  } as const;

  const result = await loadSaleReceipt("sale-1", "house-1", repository);
  assert.equal(result.ok, true);
  assert.deepEqual(
    calls.map((call) => `${call.method}:${call.houseId}`),
    ["getSaleById:house-1", "listSaleLines:house-1", "listSaleTenders:house-1"],
  );
});
