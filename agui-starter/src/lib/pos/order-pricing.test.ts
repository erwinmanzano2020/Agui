import assert from "node:assert/strict";
import test from "node:test";

import { PosOrderPricingError, computeOrderPricing } from "./order-pricing";

const SCOPE = {
  houseId: "house-1",
  branchId: "branch-1",
  sessionId: "session-1",
  deviceId: "device-1",
  orderId: "order-1",
} as const;

test("computeOrderPricing aggregates subtotal and tax deterministically", async () => {
  const result = await computeOrderPricing(SCOPE, {
    async getCurrentSessionOrderLines() {
      return [
        { item_code: "ITEM-1", quantity: 2 },
        { item_code: "ITEM-2", quantity: 1 },
      ];
    },
    getPriceForItem(itemCode) {
      if (itemCode === "ITEM-1") return 10;
      if (itemCode === "ITEM-2") return 15;
      return null;
    },
  });

  assert.deepEqual(result, { subtotal: 35, tax: 4.2, total: 39.2, currency: "USD" });
});

test("computeOrderPricing returns zero totals when there are no lines", async () => {
  const result = await computeOrderPricing(SCOPE, {
    async getCurrentSessionOrderLines() {
      return [];
    },
    getPriceForItem() {
      return 10;
    },
  });

  assert.deepEqual(result, { subtotal: 0, tax: 0, total: 0, currency: "USD" });
});

test("computeOrderPricing rejects missing item pricing", async () => {
  await assert.rejects(
    () =>
      computeOrderPricing(SCOPE, {
        async getCurrentSessionOrderLines() {
          return [{ item_code: "ITEM-UNKNOWN", quantity: 1 }];
        },
        getPriceForItem() {
          return null;
        },
      }),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "ITEM_PRICE_MISSING" &&
      error.status === 400,
  );
});
