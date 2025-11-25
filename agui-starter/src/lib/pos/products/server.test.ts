import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  __productTesting,
  getPriceForCustomerGroup,
  resolveTierForQuantity,
  upsertProductFromEncoding,
  type ProductSnapshot,
} from "./server";

const { createInMemoryProductRepository } = __productTesting;

function extractBasePrice(snapshot: ProductSnapshot) {
  const [price] = snapshot.prices;
  return price;
}

describe("pos product helpers", () => {
  it("upserts a product with base UOM and barcode", async () => {
    const repo = createInMemoryProductRepository();
    const snapshot = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Sample Item",
        baseUom: { code: "PC", name: "Piece" },
        barcodes: [{ code: "1234567890123", isPrimary: true }],
        basePrice: 1250,
      },
      repo,
    });

    assert.equal(snapshot.item.house_id, "house-1");
    assert.equal(snapshot.uoms.length, 1);
    assert.equal(snapshot.uoms[0]?.code, "PC");
    assert.equal(snapshot.barcodes.length, 1);
    assert.equal(snapshot.barcodes[0]?.barcode, "1234567890123");
    assert.equal(snapshot.barcodes[0]?.uom_id, snapshot.uoms[0]?.id ?? null);
    assert.equal(extractBasePrice(snapshot).unit_price, 1250);
  });

  it("adds UOM variants with conversion factors", async () => {
    const repo = createInMemoryProductRepository();
    const first = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Case Item",
        baseUom: { code: "PC" },
        basePrice: 500,
      },
      repo,
    });

    const updated = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        itemId: first.item.id,
        name: "Case Item",
        baseUom: { code: "PC" },
        variants: [{ code: "CASE", factorToBase: 24 }],
        basePrice: 500,
      },
      repo,
    });

    const codes = new Set(updated.uoms.map((uom) => uom.code));
    assert.ok(codes.has("PC"));
    assert.ok(codes.has("CASE"));
    const caseUom = updated.uoms.find((uom) => uom.code === "CASE");
    assert.equal(caseUom?.factor_to_base, 24);
  });

  it("selects tiered pricing based on quantity", async () => {
    const repo = createInMemoryProductRepository();
    const snapshot = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Tiered",
        baseUom: { code: "PC" },
        basePrice: 1000,
        priceTiers: [
          { minQuantity: 5, unitPrice: 950 },
          { minQuantity: 10, unitPrice: 900 },
        ],
      },
      repo,
    });

    const basePrice = extractBasePrice(snapshot);
    const tier = resolveTierForQuantity(basePrice.tiers, 7);
    assert.equal(tier?.unit_price, 950);

    const priceForOne = await getPriceForCustomerGroup({
      houseId: "house-1",
      itemId: snapshot.item.id,
      uomId: snapshot.uoms[0]?.id ?? null,
      quantity: 1,
      repo,
    });
    assert.equal(priceForOne.unitPrice, 1000);

    const priceForBulk = await getPriceForCustomerGroup({
      houseId: "house-1",
      itemId: snapshot.item.id,
      uomId: snapshot.uoms[0]?.id ?? null,
      quantity: 12,
      repo,
    });
    assert.equal(priceForBulk.unitPrice, 900);
  });

  it("upserts a price for the same item and UOM without duplicating", async () => {
    const repo = createInMemoryProductRepository();
    const first = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Repriced Item",
        baseUom: { code: "PC" },
        basePrice: 1000,
      },
      repo,
    });

    const updated = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        itemId: first.item.id,
        name: "Repriced Item",
        baseUom: { code: "PC" },
        basePrice: 1250,
      },
      repo,
    });

    assert.equal(updated.prices.length, 1);
    assert.equal(extractBasePrice(updated).unit_price, 1250);
  });

  it("treats null UOM prices as unique per item", async () => {
    const repo = createInMemoryProductRepository();

    const item = await repo.upsertItem({
      house_id: "house-1",
      name: "Service Fee",
      slug: "service-fee",
      short_name: "Fee",
    });

    const first = await repo.upsertPrice({
      house_id: "house-1",
      item_id: item.id,
      uom_id: null,
      unit_price: 3000,
      currency: "PHP",
    });

    const second = await repo.upsertPrice({
      house_id: "house-1",
      item_id: item.id,
      uom_id: null,
      unit_price: 3500,
      currency: "PHP",
    });

    const snapshot = await repo.loadSnapshot("house-1", item.id);
    assert.ok(snapshot);
    assert.equal(snapshot?.prices.length, 1);
    assert.equal(second.id, first.id);
    assert.equal(snapshot?.prices[0]?.unit_price, 3500);
  });
});
