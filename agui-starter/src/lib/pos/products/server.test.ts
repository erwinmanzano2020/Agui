import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  __productTesting,
  getPriceForCustomerGroup,
  lookupProductByBarcode,
  resolveTierForQuantity,
  upsertProductFromEncoding,
  type ProductSnapshot,
} from "./server";

const { createInMemoryProductRepository } = __productTesting;

function extractPrice(snapshot: ProductSnapshot, uomId?: string | null) {
  if (uomId) {
    return snapshot.prices.find((price) => price.uom_id === uomId) ?? snapshot.prices[0];
  }
  return snapshot.prices[0];
}

describe("pos product helpers", () => {
  it("upserts a POS-ready product with pricing and barcode", async () => {
    const repo = createInMemoryProductRepository();
    const snapshot = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Sample Item",
        shortName: "Sample",
        baseUom: { code: "PC", name: "Piece" },
        barcodes: [{ code: "1234567890123", isPrimary: true }],
        prices: [{ uomCode: "PC", unitPrice: 1250, priceType: "RETAIL", tierTag: "default" }],
      },
      repo,
    });

    assert.equal(snapshot.item.house_id, "house-1");
    assert.equal(snapshot.item.allow_in_pos, true);
    assert.equal(snapshot.uoms.length, 1);
    assert.equal(snapshot.uoms[0]?.code, "PC");
    assert.equal(snapshot.barcodes.length, 1);
    assert.equal(snapshot.barcodes[0]?.barcode, "1234567890123");
    assert.equal(snapshot.barcodes[0]?.uom_id, snapshot.uoms[0]?.id ?? null);
    assert.equal(extractPrice(snapshot).unit_price, 1250);
    assert.equal(extractPrice(snapshot).price_type, "RETAIL");
  });

  it("adds UOM variants with conversion factors and tiered prices", async () => {
    const repo = createInMemoryProductRepository();
    const first = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Case Item",
        baseUom: { code: "PC" },
        variants: [{ code: "CASE", name: "Case", factorToBase: 24 }],
        barcodes: [
          { code: "111", isPrimary: true },
          { code: "222", uomCode: "CASE", isPrimary: false },
        ],
        prices: [
          { uomCode: "PC", priceType: "RETAIL", tierTag: "default", unitPrice: 500 },
          {
            uomCode: "CASE",
            priceType: "RETAIL",
            tierTag: "wholesale",
            unitPrice: 10000,
            tiers: [
              { minQuantity: 2, unitPrice: 9500 },
              { minQuantity: 5, unitPrice: 9000 },
            ],
          },
        ],
      },
      repo,
    });

    const codes = new Set(first.uoms.map((uom) => uom.code));
    assert.ok(codes.has("PC"));
    assert.ok(codes.has("CASE"));
    const caseUom = first.uoms.find((uom) => uom.code === "CASE");
    assert.equal(caseUom?.factor_to_base, 24);

    const casePrice = extractPrice(first, caseUom?.id ?? null);
    assert.equal(casePrice.tier_tag, "wholesale");
    assert.equal(resolveTierForQuantity(casePrice.tiers, 5)?.unit_price, 9000);
  });

  it("updates prices without duplicating matching rows", async () => {
    const repo = createInMemoryProductRepository();
    const first = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Repriced Item",
        baseUom: { code: "PC" },
        barcodes: [{ code: "555" }],
        prices: [{ uomCode: "PC", priceType: "RETAIL", tierTag: "default", unitPrice: 1000 }],
      },
      repo,
    });

    const updated = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        itemId: first.item.id,
        name: "Repriced Item",
        baseUom: { code: "PC" },
        barcodes: [{ code: "555" }],
        prices: [{ uomCode: "PC", priceType: "RETAIL", tierTag: "default", unitPrice: 1250 }],
      },
      repo,
    });

    assert.equal(updated.prices.length, 1);
    assert.equal(extractPrice(updated).unit_price, 1250);
  });

  it("captures raw-material relationships and bundle flags", async () => {
    const repo = createInMemoryProductRepository();
    const snapshot = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Encoded Bundle",
        baseUom: { code: "PC" },
        isSellable: true,
        isBundle: true,
        isRepacked: false,
        barcodes: [{ code: "9900" }],
        prices: [{ uomCode: "PC", unitPrice: 1500 }],
        rawInputs: [
          { rawItemId: "raw-1", quantity: 2, outputUomCode: "PC" },
          { rawItemId: "raw-2", quantity: 1 },
        ],
        bundleComponents: [{ childItemId: "child-1", quantity: 1 }],
      },
      repo,
    });

    assert.equal(snapshot.item.is_bundle, true);
    assert.equal(snapshot.rawInputs.length, 2);
    assert.equal(snapshot.bundles.length, 1);
  });

  it("falls back to global catalog matches when local barcode is missing", async () => {
    const repo = createInMemoryProductRepository({
      globalItems: [
        {
          id: "global-1",
          barcode: "G-123",
          name: "Global Chocolate",
          brand: "AGUI",
          size: "50g",
          default_uom: "PC",
          default_category: "Snacks",
          default_shortname: "Choco",
          created_at: new Date().toISOString(),
        },
      ],
    });

    const lookup = await lookupProductByBarcode({ houseId: "house-1", barcode: "G-123", repo });

    assert.equal(lookup.snapshot, null);
    assert.equal(lookup.global?.name, "Global Chocolate");
    assert.equal(lookup.barcode, "G-123");
  });

  it("selects tiered pricing based on quantity", async () => {
    const repo = createInMemoryProductRepository();
    const snapshot = await upsertProductFromEncoding({
      houseId: "house-1",
      payload: {
        name: "Tiered",
        baseUom: { code: "PC" },
        barcodes: [{ code: "tier-1" }],
        prices: [
          {
            uomCode: "PC",
            priceType: "RETAIL",
            tierTag: "default",
            unitPrice: 1000,
            tiers: [
              { minQuantity: 5, unitPrice: 950 },
              { minQuantity: 10, unitPrice: 900 },
            ],
          },
        ],
      },
      repo,
    });

    const basePrice = extractPrice(snapshot);
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
});
