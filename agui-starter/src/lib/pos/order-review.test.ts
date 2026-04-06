import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";
import { createInMemoryPosOrderDraftRepository } from "./order-draft";
import { type OrderLine, createInMemoryPosOrderLineRepository } from "./order-line";
import { PosOrderReviewError, getCurrentSessionOrderReview } from "./order-review";

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

function createOrderReviewRepository(input?: { sessions?: PosSessionRow[]; drafts?: OrderDraft[]; lines?: OrderLine[] }) {
  const draftRepository = createInMemoryPosOrderDraftRepository({
    sessions: input?.sessions ?? [makeSession()],
    drafts: input?.drafts ?? [makeDraft()],
  });
  const lineRepository = createInMemoryPosOrderLineRepository({
    sessions: input?.sessions ?? [makeSession()],
    orders: input?.drafts ?? [makeDraft()],
    lines: input?.lines ?? [],
  });

  return {
    draftRepository,
    lineRepository,
    pricingRepository: {
      lineRepository,
      getPriceForItem(itemCode: string) {
        if (itemCode === "ITEM-1") return 10;
        if (itemCode === "ITEM-2") return 15;
        return null;
      },
    },
  };
}

test("getCurrentSessionOrderReview succeeds for valid exact scope", async () => {
  const result = await getCurrentSessionOrderReview(
    SCOPE,
    createOrderReviewRepository({
      lines: [makeLine({ quantity: 2 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 1 })],
    }),
  );

  assert.equal(result.reviewStatus, "READY");
  assert.deepEqual(result.draft, {
    id: ORDER_ID,
    houseId: HOUSE_ID,
    branchId: BRANCH_ID,
    sessionId: SESSION_ID,
    deviceId: DEVICE_ID,
    operatorEntityId: "entity-1",
    status: "DRAFT",
  });
  assert.deepEqual(result.activeLines, [
    { id: "line-1", orderId: ORDER_ID, itemCode: "ITEM-1", quantity: 2 },
    { id: "line-2", orderId: ORDER_ID, itemCode: "ITEM-2", quantity: 1 },
  ]);
  assert.deepEqual(result.pricingSummary, { subtotal: 35, tax: 4.2, total: 39.2, currency: "USD" });
  assert.deepEqual(result.pricingTraceLines, [
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
  ]);
});

test("getCurrentSessionOrderReview fails when session is closed", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderReview(
        SCOPE,
        createOrderReviewRepository({
          sessions: [makeSession({ status: "CLOSED" })],
          drafts: [makeDraft()],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderReviewError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("getCurrentSessionOrderReview fails when order is not draft", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderReview(
        SCOPE,
        createOrderReviewRepository({
          drafts: [makeDraft({ status: "CLOSED" as unknown as "DRAFT" })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderReviewError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("getCurrentSessionOrderReview fails on mismatched current-session scope", async () => {
  await assert.rejects(
    () => getCurrentSessionOrderReview({ ...SCOPE, deviceId: "device-2" }, createOrderReviewRepository()),
    (error: unknown) =>
      error instanceof PosOrderReviewError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("getCurrentSessionOrderReview propagates pricing failures as bounded review errors", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderReview(
        SCOPE,
        createOrderReviewRepository({
          lines: [makeLine({ item_code: "ITEM-UNKNOWN", quantity: 1 })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderReviewError &&
      error.code === "ITEM_PRICE_MISSING" &&
      error.status === 400,
  );
});

test("getCurrentSessionOrderReview never leaks cross-session or cross-device lines", async () => {
  const result = await getCurrentSessionOrderReview(
    SCOPE,
    createOrderReviewRepository({
      lines: [
        makeLine({ id: "line-valid", quantity: 1 }),
        makeLine({ id: "line-other-session", session_id: "session-2", quantity: 7 }),
        makeLine({ id: "line-other-device", device_id: "device-2", quantity: 8 }),
      ],
    }),
  );

  assert.deepEqual(result.activeLines, [{ id: "line-valid", orderId: ORDER_ID, itemCode: "ITEM-1", quantity: 1 }]);
  assert.deepEqual(result.pricingTraceLines.map((line) => line.lineId), ["line-valid"]);
});

test("getCurrentSessionOrderReview reuses one scoped line snapshot for active lines and pricing trace", async () => {
  const session = makeSession();
  const draft = makeDraft();
  let readCount = 0;
  const firstSnapshot = [makeLine({ id: "line-snapshot-1", item_code: "ITEM-1", quantity: 2 })];
  const secondSnapshot = [makeLine({ id: "line-snapshot-2", item_code: "ITEM-2", quantity: 3 })];

  const result = await getCurrentSessionOrderReview(SCOPE, {
    draftRepository: {
      async getSessionById() {
        return session;
      },
      async getDraftOrderById() {
        return draft;
      },
      async insertOrderDraft() {
        throw new Error("not used");
      },
    },
    lineRepository: {
      async getSessionById() {
        return session;
      },
      async getOrderDraftById() {
        return draft;
      },
      async getOrderLinesByDraft() {
        readCount += 1;
        return readCount === 1 ? firstSnapshot : secondSnapshot;
      },
      async insertOrderLine() {
        throw new Error("not used");
      },
      async updateOrderLine() {
        throw new Error("not used");
      },
      async removeOrderLine() {
        throw new Error("not used");
      },
    },
    pricingRepository: {
      getPriceForItem(itemCode: string) {
        if (itemCode === "ITEM-1") return 10;
        if (itemCode === "ITEM-2") return 15;
        return null;
      },
    },
  });

  assert.equal(readCount, 1);
  assert.deepEqual(result.activeLines.map((line) => line.id), ["line-snapshot-1"]);
  assert.deepEqual(result.pricingTraceLines.map((line) => line.lineId), ["line-snapshot-1"]);
  assert.deepEqual(result.pricingSummary, { subtotal: 20, tax: 2.4, total: 22.4, currency: "USD" });
});
