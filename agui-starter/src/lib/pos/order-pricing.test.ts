import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";
import { type OrderLine, createInMemoryPosOrderLineRepository } from "./order-line";
import { PosOrderPricingError, computeOrderPricing, computeOrderPricingFromScopedLines } from "./order-pricing";

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

  assert.deepEqual(result, {
    subtotal: 35,
    tax: 4.2,
    total: 39.2,
    currency: "USD",
    lines: [
      {
        lineId: "line-1",
        itemCode: "ITEM-1",
        quantity: 2,
        unitPrice: 10,
        lineTotal: 20,
        pricingSource: "bounded_default",
        pricingInputSource: "default",
      },
      {
        lineId: "line-2",
        itemCode: "ITEM-2",
        quantity: 1,
        unitPrice: 15,
        lineTotal: 15,
        pricingSource: "bounded_default",
        pricingInputSource: "default",
      },
    ],
  });
});

test("computeOrderPricing returns zero totals only for valid scoped draft context with zero lines", async () => {
  const result = await computeOrderPricing(SCOPE, createScopedPricingRepository({ lines: [] }));
  assert.deepEqual(result, { subtotal: 0, tax: 0, total: 0, currency: "USD", lines: [] });
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

test("computeOrderPricing rejects prototype-chain-like item codes as missing prices", async () => {
  for (const key of ["toString", "constructor", "__proto__"]) {
    await assert.rejects(
      () =>
        computeOrderPricing(
          SCOPE,
          createScopedPricingRepository({
            lines: [makeLine({ id: `line-${key}`, item_code: key, quantity: 1 })],
          }),
        ),
      (error: unknown) =>
        error instanceof PosOrderPricingError &&
        error.code === "ITEM_PRICE_MISSING" &&
        error.status === 400,
    );
  }
});

test("computeOrderPricing rejects non-finite unit prices instead of returning NaN totals", async () => {
  await assert.rejects(
    () =>
      computeOrderPricing(SCOPE, {
        lineRepository: createInMemoryPosOrderLineRepository({
          sessions: [makeSession()],
          orders: [makeDraft()],
          lines: [makeLine({ item_code: "ITEM-1", quantity: 1 })],
        }),
        getPriceForItem() {
          return Number.NaN;
        },
      }),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "ITEM_PRICE_MISSING" &&
      error.status === 400,
  );
});

test("computeOrderPricing applies bounded line override and marks pricing source", async () => {
  const result = await computeOrderPricing(
    {
      ...SCOPE,
      pricingInput: {
        lineUnitPriceOverrides: {
          "line-override": { unitPrice: 7.25, source: "manual" },
        },
      },
    },
    createScopedPricingRepository({
      lines: [makeLine({ id: "line-override", item_code: "ITEM-1", quantity: 2 })],
    }),
  );

  assert.deepEqual(result, {
    subtotal: 14.5,
    tax: 1.74,
    total: 16.24,
    currency: "USD",
    lines: [
      {
        lineId: "line-override",
        itemCode: "ITEM-1",
        quantity: 2,
        unitPrice: 7.25,
        lineTotal: 14.5,
        pricingSource: "override",
        pricingInputSource: "manual",
      },
    ],
  });
});

test("computeOrderPricingFromScopedLines computes deterministic totals from provided scoped snapshot", async () => {
  const result = await computeOrderPricingFromScopedLines(
    {
      lines: [makeLine({ id: "line-1", item_code: "ITEM-1", quantity: 1 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 2 })],
    },
    (itemCode: string) => {
      if (itemCode === "ITEM-1") return 10;
      if (itemCode === "ITEM-2") return 15;
      return null;
    },
  );

  assert.deepEqual(result, {
    subtotal: 40,
    tax: 4.8,
    total: 44.8,
    currency: "USD",
    lines: [
      {
        lineId: "line-1",
        itemCode: "ITEM-1",
        quantity: 1,
        unitPrice: 10,
        lineTotal: 10,
        pricingSource: "bounded_default",
        pricingInputSource: "default",
      },
      {
        lineId: "line-2",
        itemCode: "ITEM-2",
        quantity: 2,
        unitPrice: 15,
        lineTotal: 30,
        pricingSource: "bounded_default",
        pricingInputSource: "default",
      },
    ],
  });
});

test("computeOrderPricing rejects invalid override values (NaN, Infinity, negative)", async () => {
  for (const invalidPrice of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    await assert.rejects(
      () =>
        computeOrderPricing(
          {
            ...SCOPE,
            pricingInput: {
              lineUnitPriceOverrides: {
                "line-1": { unitPrice: invalidPrice },
              },
            },
          },
          createScopedPricingRepository({
            lines: [makeLine({ id: "line-1", item_code: "ITEM-1", quantity: 1 })],
          }),
        ),
      (error: unknown) =>
        error instanceof PosOrderPricingError &&
        error.code === "INVALID_OVERRIDE_UNIT_PRICE" &&
        error.status === 400,
    );
  }
});

test("computeOrderPricing rejects malformed override entries (null, primitive, array) with bounded error", async () => {
  for (const malformedEntry of [null, 123, ["bad"]]) {
    await assert.rejects(
      () =>
        computeOrderPricing(
          {
            ...SCOPE,
            pricingInput: {
              lineUnitPriceOverrides: {
                "line-1": malformedEntry as unknown as { unitPrice: number },
              },
            },
          },
          createScopedPricingRepository({
            lines: [makeLine({ id: "line-1", item_code: "ITEM-1", quantity: 1 })],
          }),
        ),
      (error: unknown) =>
        error instanceof PosOrderPricingError &&
        error.code === "INVALID_OVERRIDE_UNIT_PRICE" &&
        error.status === 400,
    );
  }
});

test("computeOrderPricing rejects invalid override source values", async () => {
  await assert.rejects(
    () =>
      computeOrderPricing(
        {
          ...SCOPE,
          pricingInput: {
            lineUnitPriceOverrides: {
              "line-1": { unitPrice: 2, source: "AUTO" as "manual" },
            },
          },
        },
        createScopedPricingRepository({
          lines: [makeLine({ id: "line-1", item_code: "ITEM-1", quantity: 1 })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "INVALID_PRICING_INPUT_SOURCE" &&
      error.status === 400,
  );
});

test("computeOrderPricing override cannot bypass scope checks", async () => {
  await assert.rejects(
    () =>
      computeOrderPricing(
        {
          ...SCOPE,
          deviceId: "wrong-device",
          pricingInput: {
            lineUnitPriceOverrides: {
              "line-1": { unitPrice: 1 },
            },
          },
        },
        createScopedPricingRepository({
          lines: [makeLine({ id: "line-1", item_code: "ITEM-1", quantity: 2 })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderPricingError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("computeOrderPricing supports mixed default and override lines with stable rounding", async () => {
  const result = await computeOrderPricing(
    {
      ...SCOPE,
      pricingInput: {
        lineUnitPriceOverrides: {
          "line-2": { unitPrice: 2.335 },
        },
      },
    },
    createScopedPricingRepository({
      lines: [
        makeLine({ id: "line-1", item_code: "ITEM-1", quantity: 2 }),
        makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 3 }),
      ],
    }),
  );

  assert.deepEqual(result, {
    subtotal: 27.01,
    tax: 3.24,
    total: 30.25,
    currency: "USD",
    lines: [
      {
        lineId: "line-1",
        itemCode: "ITEM-1",
        quantity: 2,
        unitPrice: 10,
        lineTotal: 20,
        pricingSource: "bounded_default",
        pricingInputSource: "default",
      },
      {
        lineId: "line-2",
        itemCode: "ITEM-2",
        quantity: 3,
        unitPrice: 2.335,
        lineTotal: 7.01,
        pricingSource: "override",
        pricingInputSource: "manual",
      },
    ],
  });
});
