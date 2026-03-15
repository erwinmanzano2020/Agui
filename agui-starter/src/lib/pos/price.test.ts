import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DUPLICATE_SCAN_WINDOW_MS,
  QUANTITY_PREFIX_TIMEOUT_MS,
  calculateGrandTotal,
  repriceCart,
  shouldIgnoreDuplicateScan,
  toCentavos,
  updateQuantityPrefix,
  type CartLine,
  type CatalogItem,
  type QuantityPrefixState,
} from "./price";

describe("pos pricing", () => {
  const catalog: Record<string, CatalogItem> = {
    "sku-1": {
      id: "sku-1",
      price: 1500,
      tiers: [
        { minQuantity: 1, unitPrice: 1500 },
        { minQuantity: 3, unitPrice: 1400 },
        { minQuantity: 5, unitPrice: 1300 },
      ],
    },
    "sku-2": {
      id: "sku-2",
      price: 2750,
    },
  };

  it("applies the best tier based on cart-wide quantity", () => {
    const cart: CartLine[] = [
      { lineId: "a", itemId: "sku-1", quantity: 2 },
      { lineId: "b", itemId: "sku-1", quantity: 3 },
      { lineId: "c", itemId: "sku-2", quantity: 1 },
    ];

    const priced = repriceCart(cart, catalog);

    assert.deepEqual(
      priced.map((line) => ({ id: line.lineId, unitPrice: line.unitPrice, tier: line.appliedTier?.minQuantity ?? 0 })),
      [
        { id: "a", unitPrice: 1300, tier: 5 },
        { id: "b", unitPrice: 1300, tier: 5 },
        { id: "c", unitPrice: 2750, tier: 0 },
      ],
    );

    assert.equal(calculateGrandTotal(priced), 1300 * 5 + 2750);
  });

  it("reprices deterministically without mutating input", () => {
    const cart: CartLine[] = [
      { lineId: "x", itemId: "sku-1", quantity: 1 },
      { lineId: "y", itemId: "sku-1", quantity: 4 },
      { lineId: "z", itemId: "sku-2", quantity: 2 },
    ];

    const snapshot = cart.map((line) => ({ ...line }));
    const priced = repriceCart(cart, catalog);

    assert.deepEqual(cart, snapshot, "input cart should not be mutated");
    assert.deepEqual(
      priced.map((line) => line.unitPrice),
      [1300, 1300, 2750],
    );
    assert.deepEqual(priced.map((line) => line.lineTotal), [1300, 5200, 5500]);
  });

  it("converts floating point amounts to centavos", () => {
    assert.equal(toCentavos(12.345), 1235);
    assert.equal(toCentavos(0.01), 1);
    assert.equal(toCentavos(0), 0);
    assert.throws(() => toCentavos(Number.NaN));
  });
});

describe("pos input helpers", () => {
  it("ignores duplicate scans inside the debounce window", () => {
    const first = { barcode: "123", timestamp: 1_000 };
    const second = { barcode: "123", timestamp: 1_000 + DUPLICATE_SCAN_WINDOW_MS - 1 };
    const third = { barcode: "123", timestamp: 1_000 + DUPLICATE_SCAN_WINDOW_MS + 1 };

    assert.equal(shouldIgnoreDuplicateScan(first, second), true);
    assert.equal(shouldIgnoreDuplicateScan(first, third), false);
  });

  it("resets the quantity prefix after the timeout", () => {
    const now = Date.now();
    let state: QuantityPrefixState | null = null;

    state = updateQuantityPrefix(state, 1, now);
    assert.equal(state.value, 1);

    state = updateQuantityPrefix(state, 2, now + 500);
    assert.equal(state.value, 12);

    state = updateQuantityPrefix(state, 3, now + 500 + QUANTITY_PREFIX_TIMEOUT_MS + 1);
    assert.equal(state.value, 3);
  });
});
