import assert from "node:assert";
import test from "node:test";

import type { ItemRow, ItemUomRow, PosSaleLineRow, PosSaleRow } from "@/lib/db.types";

import {
  applyInventoryForSale,
  createInMemoryInventoryCatalogRepository,
  createInMemoryStockMovementRepository,
} from "../server";

const houseId = "house-1";
const now = new Date().toISOString();

function buildItem(id: string, overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id,
    house_id: houseId,
    slug: null,
    name: id,
    short_name: null,
    brand: null,
    category: null,
    category_id: null,
    subcategory_id: null,
    is_sellable: true,
    is_raw_material: false,
    is_repacked: false,
    is_bundle: false,
    allow_in_pos: true,
    global_item_id: null,
    track_inventory: true,
    meta: {},
    created_at: now,
    updated_at: null,
    ...overrides,
  } satisfies ItemRow;
}

function buildUom(id: string, itemId: string, factorToBase: number, overrides: Partial<ItemUomRow> = {}): ItemUomRow {
  return {
    id,
    house_id: houseId,
    item_id: itemId,
    code: id,
    name: null,
    is_base: false,
    factor_to_base: factorToBase,
    variant_label: null,
    allow_branch_override: false,
    created_at: now,
    updated_at: null,
    ...overrides,
  } satisfies ItemUomRow;
}

function buildSaleLine(overrides: Partial<PosSaleLineRow> = {}): PosSaleLineRow {
  return {
    id: overrides.id ?? "line-1",
    sale_id: overrides.sale_id ?? "sale-1",
    house_id: overrides.house_id ?? houseId,
    item_id: overrides.item_id ?? "item-1",
    uom_id: overrides.uom_id ?? null,
    barcode: overrides.barcode ?? null,
    name_snapshot: overrides.name_snapshot ?? "Item",
    uom_label_snapshot: overrides.uom_label_snapshot ?? null,
    quantity: overrides.quantity ?? 1,
    unit_price_cents: overrides.unit_price_cents ?? 100,
    line_total_cents: overrides.line_total_cents ?? 100,
    tier_applied: overrides.tier_applied ?? null,
    meta: overrides.meta ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  } satisfies PosSaleLineRow;
}

function buildSale(overrides: Partial<PosSaleRow> = {}): PosSaleRow {
  return {
    id: overrides.id ?? "sale-1",
    house_id: overrides.house_id ?? houseId,
    workspace_id: overrides.workspace_id ?? null,
    sequence_no: overrides.sequence_no ?? 1,
    receipt_number: overrides.receipt_number ?? "R-1",
    status: overrides.status ?? "COMPLETED",
    subtotal_cents: overrides.subtotal_cents ?? 100,
    discount_cents: overrides.discount_cents ?? 0,
    total_cents: overrides.total_cents ?? 100,
    amount_received_cents: overrides.amount_received_cents ?? 100,
    change_cents: overrides.change_cents ?? 0,
    outstanding_cents: overrides.outstanding_cents ?? 0,
    customer_entity_id: overrides.customer_entity_id ?? null,
    customer_name: overrides.customer_name ?? null,
    customer_ref: overrides.customer_ref ?? null,
    meta: overrides.meta ?? null,
    created_at: overrides.created_at ?? now,
    created_by: overrides.created_by ?? null,
    closed_at: overrides.closed_at ?? now,
    shift_id: overrides.shift_id ?? null,
  } satisfies PosSaleRow;
}

test("base UOM sale deducts base quantity", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [buildItem("item-1")],
    uoms: [buildUom("uom-1", "item-1", 1, { is_base: true })],
  });
  const movements = createInMemoryStockMovementRepository();

  await applyInventoryForSale(buildSale(), [buildSaleLine({ quantity: 2, uom_id: "uom-1" })], {
    catalog,
    movements,
  });

  assert.equal(movements.movements.length, 1);
  assert.equal(movements.movements[0]?.quantity_delta, -2);
  assert.equal(movements.movements[0]?.item_id, "item-1");
  assert.equal(movements.movements[0]?.uom_id, "uom-1");
  assert.equal(movements.movements[0]?.is_overdrawn, true);
});

test("non-base UOM converts quantity to base", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [buildItem("item-2")],
    uoms: [
      buildUom("base-2", "item-2", 1, { is_base: true }),
      buildUom("case-2", "item-2", 6),
    ],
  });
  const movements = createInMemoryStockMovementRepository();

  await applyInventoryForSale(
    buildSale({ id: "sale-2" }),
    [buildSaleLine({ id: "line-2", sale_id: "sale-2", item_id: "item-2", uom_id: "case-2", quantity: 2 })],
    { catalog, movements },
  );

  assert.equal(movements.movements.length, 1);
  assert.equal(movements.movements[0]?.quantity_delta, -12);
  assert.equal(movements.movements[0]?.uom_id, "base-2");
});

test("bundle sale fans out to components", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [buildItem("bundle", { is_bundle: true }), buildItem("child-a"), buildItem("child-b")],
    uoms: [
      buildUom("bundle-base", "bundle", 1, { is_base: true }),
      buildUom("child-a-base", "child-a", 1, { is_base: true }),
      buildUom("child-b-base", "child-b", 1, { is_base: true }),
    ],
    bundles: [
      { id: "b1", house_id: houseId, bundle_parent_id: "bundle", child_item_id: "child-a", child_uom_id: "child-a-base", quantity: 2, cost_strategy: "ALLOCATE", created_at: now },
      { id: "b2", house_id: houseId, bundle_parent_id: "bundle", child_item_id: "child-b", child_uom_id: "child-b-base", quantity: 1, cost_strategy: "ALLOCATE", created_at: now },
    ],
  });
  const movements = createInMemoryStockMovementRepository();

  await applyInventoryForSale(
    buildSale({ id: "sale-bundle" }),
    [buildSaleLine({ id: "line-bundle", sale_id: "sale-bundle", item_id: "bundle", uom_id: "bundle-base", quantity: 3 })],
    { catalog, movements },
  );

  assert.equal(movements.movements.length, 2);
  const childA = movements.movements.find((row) => row.item_id === "child-a");
  const childB = movements.movements.find((row) => row.item_id === "child-b");
  assert.equal(childA?.quantity_delta, -6);
  assert.equal(childB?.quantity_delta, -3);
});

test("bundle with non-base parent UOM scales component usage from base quantity", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [buildItem("bundle", { is_bundle: true }), buildItem("child")],
    uoms: [
      buildUom("bundle-base", "bundle", 1, { is_base: true }),
      buildUom("bundle-case", "bundle", 6),
      buildUom("child-base", "child", 1, { is_base: true }),
    ],
    bundles: [
      {
        id: "bundle-component-1",
        house_id: houseId,
        bundle_parent_id: "bundle",
        child_item_id: "child",
        child_uom_id: "child-base",
        quantity: 2,
        cost_strategy: "ALLOCATE",
        created_at: now,
      },
    ],
  });
  const movements = createInMemoryStockMovementRepository();

  await applyInventoryForSale(
    buildSale({ id: "sale-bundle-case" }),
    [
      buildSaleLine({
        id: "line-bundle-case",
        sale_id: "sale-bundle-case",
        item_id: "bundle",
        uom_id: "bundle-case",
        quantity: 1,
      }),
    ],
    { catalog, movements },
  );

  assert.equal(movements.movements.length, 1);
  assert.equal(movements.movements[0]?.item_id, "child");
  assert.equal(movements.movements[0]?.quantity_delta, -12);
});

test("raw input deduction uses source material", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [
      buildItem("finished", { is_repacked: true, track_inventory: false }),
      buildItem("raw", { is_raw_material: true }),
    ],
    uoms: [
      buildUom("finished-base", "finished", 1, { is_base: true }),
      buildUom("raw-base", "raw", 1, { is_base: true }),
      buildUom("raw-kg", "raw", 1000),
    ],
    rawInputs: [
      {
        id: "ri-1",
        house_id: houseId,
        finished_item_id: "finished",
        raw_item_id: "raw",
        input_uom_id: "raw-kg",
        output_uom_id: "finished-base",
        quantity: 0.5,
        expected_yield: null,
        created_at: now,
      },
    ],
  });
  const movements = createInMemoryStockMovementRepository();

  await applyInventoryForSale(
    buildSale({ id: "sale-raw" }),
    [buildSaleLine({ id: "line-raw", sale_id: "sale-raw", item_id: "finished", uom_id: "finished-base", quantity: 4 })],
    { catalog, movements },
  );

  assert.equal(movements.movements.length, 1);
  assert.equal(movements.movements[0]?.item_id, "raw");
  assert.equal(movements.movements[0]?.quantity_delta, -2000);
});

test("raw input deduction scales with non-base parent UOM", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [
      buildItem("finished", { is_repacked: true, track_inventory: false }),
      buildItem("raw", { is_raw_material: true }),
    ],
    uoms: [
      buildUom("finished-base", "finished", 1, { is_base: true }),
      buildUom("finished-case", "finished", 12),
      buildUom("raw-base", "raw", 1, { is_base: true }),
      buildUom("raw-kg", "raw", 1000),
    ],
    rawInputs: [
      {
        id: "ri-case",
        house_id: houseId,
        finished_item_id: "finished",
        raw_item_id: "raw",
        input_uom_id: "raw-kg",
        output_uom_id: "finished-base",
        quantity: 0.5,
        expected_yield: null,
        created_at: now,
      },
    ],
  });
  const movements = createInMemoryStockMovementRepository();

  await applyInventoryForSale(
    buildSale({ id: "sale-raw-case" }),
    [
      buildSaleLine({
        id: "line-raw-case",
        sale_id: "sale-raw-case",
        item_id: "finished",
        uom_id: "finished-case",
        quantity: 2,
      }),
    ],
    { catalog, movements },
  );

  assert.equal(movements.movements.length, 1);
  assert.equal(movements.movements[0]?.item_id, "raw");
  assert.equal(movements.movements[0]?.quantity_delta, -12000);
});

test("inventory posting is idempotent per sale line", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [buildItem("item-3")],
    uoms: [buildUom("base-3", "item-3", 1, { is_base: true })],
  });
  const movements = createInMemoryStockMovementRepository();
  const sale = buildSale({ id: "sale-3" });
  const line = buildSaleLine({ id: "line-3", sale_id: "sale-3", item_id: "item-3", uom_id: "base-3", quantity: 1 });

  await applyInventoryForSale(sale, [line], { catalog, movements });
  await applyInventoryForSale(sale, [line], { catalog, movements });

  assert.equal(movements.movements.length, 1);
  assert.equal(movements.movements[0]?.quantity_delta, -1);
});

test("movements stay house-scoped", async () => {
  const catalog = createInMemoryInventoryCatalogRepository({
    items: [buildItem("item-4")],
    uoms: [buildUom("base-4", "item-4", 1, { is_base: true })],
  });
  const movements = createInMemoryStockMovementRepository();
  const sale = buildSale({ id: "sale-4", house_id: "house-x" });
  const line = buildSaleLine({ id: "line-4", sale_id: "sale-4", house_id: "house-x", item_id: "item-4", uom_id: "base-4", quantity: 2 });

  await applyInventoryForSale(sale, [line], { catalog, movements });

  assert.equal(movements.movements[0]?.house_id, "house-x");
});
