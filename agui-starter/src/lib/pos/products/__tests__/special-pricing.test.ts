import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInMemoryProductRepository, resolveSpecialPrice } from "../server";
import type { CustomerPriceRuleRow } from "@/lib/db.types";

const houseId = "house-1";
const itemId = "item-1";
const uomId = "uom-1";
const categoryId = "cat-1";

let idCounter = 1;
function buildRule(overrides: Partial<CustomerPriceRuleRow>): CustomerPriceRuleRow {
  return {
    id: overrides.id ?? `rule-${idCounter++}`,
    house_id: overrides.house_id ?? houseId,
    item_id: overrides.item_id ?? itemId,
    uom_id: overrides.uom_id ?? null,
    customer_id: overrides.customer_id ?? null,
    customer_group_id: overrides.customer_group_id ?? null,
    rule_type: overrides.rule_type ?? "PERCENT_DISCOUNT",
    percent_off: overrides.percent_off ?? 5,
    fixed_price_cents: overrides.fixed_price_cents ?? null,
    applies_to_category_id: overrides.applies_to_category_id ?? null,
    is_active: overrides.is_active ?? true,
    valid_from: overrides.valid_from ?? null,
    valid_to: overrides.valid_to ?? null,
    created_at: overrides.created_at ?? new Date("2024-01-01T00:00:00Z").toISOString(),
    updated_at: overrides.updated_at ?? null,
  } satisfies CustomerPriceRuleRow;
}

describe("resolveSpecialPrice", () => {
  it("returns base price without customer context", async () => {
    const repo = createInMemoryProductRepository();
    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      baseUnitPriceCents: 1200,
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 1200);
    assert.equal(result.appliedRule, undefined);
  });

  it("applies a group percent discount", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [buildRule({ customer_group_id: "group-1", percent_off: 5, rule_type: "PERCENT_DISCOUNT" })],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      categoryId,
      baseUnitPriceCents: 180,
      customerGroupId: "group-1",
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 171);
    assert.equal(result.appliedRule?.type, "PERCENT_DISCOUNT");
  });

  it("prefers fixed price over base", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [
        buildRule({ customer_group_id: "group-2", rule_type: "FIXED_PRICE", fixed_price_cents: 405, percent_off: null }),
      ],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      baseUnitPriceCents: 437,
      customerGroupId: "group-2",
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 405);
  });

  it("gives priority to customer rules over group rules", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [
        buildRule({ customer_group_id: "group-3", rule_type: "FIXED_PRICE", fixed_price_cents: 405, percent_off: null }),
        buildRule({ customer_id: "customer-1", rule_type: "FIXED_PRICE", fixed_price_cents: 390, percent_off: null }),
      ],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      baseUnitPriceCents: 437,
      customerId: "customer-1",
      customerGroupId: "group-3",
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 390);
    assert.equal(result.appliedRule?.source, "CUSTOMER");
  });

  it("prefers item and UOM rules over category rules", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [
        buildRule({
          customer_group_id: "group-4",
          applies_to_category_id: categoryId,
          percent_off: 10,
          item_id: null,
        }),
        buildRule({
          customer_group_id: "group-4",
          rule_type: "FIXED_PRICE",
          fixed_price_cents: 500,
          percent_off: null,
          uom_id: uomId,
        }),
      ],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      categoryId,
      baseUnitPriceCents: 700,
      customerGroupId: "group-4",
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 500);
  });

  it("ignores inactive rules", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [buildRule({ customer_group_id: "group-5", is_active: false, percent_off: 50 })],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      baseUnitPriceCents: 1000,
      customerGroupId: "group-5",
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 1000);
  });

  it("ignores expired rules", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [
        buildRule({
          customer_group_id: "group-6",
          percent_off: 20,
          valid_to: new Date("2024-01-01T00:00:00Z").toISOString(),
        }),
      ],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      baseUnitPriceCents: 500,
      customerGroupId: "group-6",
      now: new Date("2025-02-01T00:00:00Z"),
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 500);
  });

  it("coerces negative percent discounts to no change", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [buildRule({ customer_group_id: "group-7", percent_off: -10 })],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      baseUnitPriceCents: 800,
      customerGroupId: "group-7",
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 800);
  });

  it("clips extreme discounts to zero", async () => {
    const repo = createInMemoryProductRepository({
      customerPriceRules: [buildRule({ customer_group_id: "group-8", percent_off: 200 })],
    });

    const result = await resolveSpecialPrice({
      houseId,
      itemId,
      uomId,
      baseUnitPriceCents: 999,
      customerGroupId: "group-8",
      repo,
    });

    assert.equal(result.finalUnitPriceCents, 0);
  });
});
