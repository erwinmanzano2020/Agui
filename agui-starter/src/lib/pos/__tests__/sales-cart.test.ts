import assert from "node:assert";
import test from "node:test";

import { cartReducer, createCartState, type CartUom, type PosCartLine, formatMoney } from "../sales-cart";

const demoUom: CartUom = { id: "uom-1", code: "PC", label: null, factorToBase: 1 };

function sampleLine(overrides?: Partial<PosCartLine>): PosCartLine {
  return {
    id: "line-1",
    itemId: "item-1",
    itemName: "Sample",
    barcode: "123",
    quantity: 1,
    unitPrice: 500,
    tierTag: null,
    uomId: demoUom.id,
    uomCode: demoUom.code,
    uomLabel: demoUom.label,
    lineTotal: 500,
    uoms: [demoUom],
    ...overrides,
  };
}

test("formatMoney renders pesos", () => {
  assert.equal(formatMoney(12345), "₱123.45");
});

test("cart merges identical item and uom", () => {
  let state = createCartState();
  state = cartReducer(state, { type: "add", payload: sampleLine({ id: "a", quantity: 1 }) });
  state = cartReducer(state, { type: "add", payload: sampleLine({ id: "b", quantity: 2, unitPrice: 600 }) });

  assert.equal(state.lines.length, 1);
  assert.equal(state.lines[0]?.quantity, 2);
  assert.equal(state.lines[0]?.unitPrice, 600);
});

test("changing quantity updates totals", () => {
  let state = cartReducer(createCartState(), { type: "add", payload: sampleLine({ quantity: 1 }) });
  state = cartReducer(state, { type: "quantity", id: state.lines[0]!.id, quantity: 3, price: { unitPrice: 1000, tierTag: "bulk" } });

  assert.equal(state.lines[0]?.quantity, 3);
  assert.equal(state.lines[0]?.lineTotal, 3000);
  assert.equal(state.lines[0]?.tierTag, "bulk");
});

test("changing UOM swaps identifiers", () => {
  const caseUom: CartUom = { id: "case", code: "CASE", label: "Case", factorToBase: 12 };
  let state = cartReducer(createCartState(), { type: "add", payload: sampleLine({ quantity: 1, uoms: [demoUom, caseUom] }) });
  state = cartReducer(state, {
    type: "uom",
    id: state.lines[0]!.id,
    uom: caseUom,
    price: { unitPrice: 9999, tierTag: "case" },
  });

  assert.equal(state.lines[0]?.uomId, "case");
  assert.equal(state.lines[0]?.unitPrice, 9999);
  assert.equal(state.lines[0]?.tierTag, "case");
});

test("repeat last line duplicates the payload", () => {
  let state = cartReducer(createCartState(), { type: "add", payload: sampleLine({ id: "line-a", quantity: 1 }) });
  state = cartReducer(state, { type: "repeat" });

  assert.equal(state.lines.length, 2);
  assert.notEqual(state.lines[0]?.id, state.lines[1]?.id);
  assert.equal(state.lines[1]?.quantity, 1);
});
