import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";
import { type OrderLine, createInMemoryPosOrderLineRepository } from "./order-line";
import { PosOrderPricingError, computeOrderPricing } from "./order-pricing";

const HOUSE_ID = "house-1";
const BRANCH_ID = "branch-1";
const SESSION_ID = "session-1";
const DEVICE_ID = "device-1";
const ORDER_ID = "order-1";

const SCOPE = {
  houseId: HOUSE_ID,
  branchId: BRANCH_ID,
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  orderId: ORDER_ID,
} as const;

function makeSession(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  const now = new Date().toISOString();
  return {
    id: SESSION_ID,
    house_id: HOUSE_ID,
    branch_id: BRANCH_ID,
    device_id: DEVICE_ID,
    operator_entity_id: "entity-1",
    opened_by_entity_id: "entity-1",
    closed_by_entity_id: null,
    status: "OPEN",
    opened_at: now,
    closed_at: null,
    close_reason: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeDraft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  const now = new Date().toISOString();
  return {
    id: ORDER_ID,
    house_id: HOUSE_ID,
    branch_id: BRANCH_ID,
    session_id: SESSION_ID,
    device_id: DEVICE_ID,
    operator_entity_id: "entity-1",
    status: "DRAFT",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  const now = new Date().toISOString();
  return {
    id: "line-1",
    order_id: ORDER_ID,
    house_id: HOUSE_ID,
    branch_id: BRANCH_ID,
    session_id: SESSION_ID,
    device_id: DEVICE_ID,
    operator_entity_id: "entity-1",
    item_code: "ITEM-1",
    quantity: 1,
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createScopedPricingRepository(input?: { sessions?: PosSessionRow[]; orders?: OrderDraft[]; lines?: OrderLine[] }) {
  const repo = createInMemoryPosOrderLineRepository({
    sessions: input?.sessions ?? [makeSession()],
    orders: input?.orders ?? [makeDraft()],
    lines: input?.lines ?? [],
  });
  return {
    lineRepository: repo,
    getPriceForItem(itemCode: string) {
      if (itemCode === "ITEM-1") return 10;
      if (itemCode === "ITEM-2") return 15;
      return null;
    },
  };
}

test("computeOrderPricing succeeds for exact valid current-session scope", async () => {
  const result = await computeOrderPricing(
    SCOPE,
    createScopedPricingRepository({
      lines: [makeLine({ item_code: "ITEM-1", quantity: 2 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 1 })],
    }),
  );

  assert.deepEqual(result, { subtotal: 35, tax: 4.2, total: 39.2, currency: "USD" });
});

test("computeOrderPricing returns zero totals only for valid scoped draft context with zero lines", async () => {
  const result = await computeOrderPricing(SCOPE, createScopedPricingRepository({ lines: [] }));
  assert.deepEqual(result, { subtotal: 0, tax: 0, total: 0, currency: "USD" });
});

test("computeOrderPricing fails when the session is closed", async () => {
  await assert.rejects(
    () => computeOrderPricing(SCOPE, createScopedPricingRepository({ sessions: [makeSession({ status: "CLOSED" })] })),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("computeOrderPricing fails when order is not draft", async () => {
  await assert.rejects(
    () =>
      computeOrderPricing(
        SCOPE,
        createScopedPricingRepository({ orders: [makeDraft({ status: "CLOSED" as unknown as "DRAFT" })] }),
      ),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("computeOrderPricing fails when scope is mismatched", async () => {
  await assert.rejects(
    () =>
      computeOrderPricing(
        { ...SCOPE, deviceId: "device-2" },
        createScopedPricingRepository({
          lines: [makeLine({ quantity: 7 })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("computeOrderPricing rejects missing bounded prices after scoped validation", async () => {
  await assert.rejects(
    () =>
      computeOrderPricing(
        SCOPE,
        createScopedPricingRepository({
          lines: [makeLine({ item_code: "ITEM-UNKNOWN", quantity: 1 })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "ITEM_PRICE_MISSING" &&
      error.status === 400,
  );
});
