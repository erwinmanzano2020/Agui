import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";
import { createInMemoryPosOrderDraftRepository } from "./order-draft";
import { type OrderLine, createInMemoryPosOrderLineRepository } from "./order-line";
import {
  PosOrderCheckoutTransitionError,
  getCurrentSessionOrderCheckoutTransition,
} from "./order-checkout-transition";

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

function createOrderCheckoutTransitionRepository(input?: {
  sessions?: PosSessionRow[];
  drafts?: OrderDraft[];
  lines?: OrderLine[];
}) {
  const sessions = input?.sessions ?? [makeSession()];
  const drafts = input?.drafts ?? [makeDraft()];
  const lines = input?.lines ?? [];

  const draftRepository = createInMemoryPosOrderDraftRepository({ sessions, drafts });
  const lineRepository = createInMemoryPosOrderLineRepository({ sessions, orders: drafts, lines });

  return {
    reviewValidationRepository: {
      draftRepository,
      lineRepository,
      pricingRepository: {
        getPriceForItem(itemCode: string) {
          if (itemCode === "ITEM-1") return 10;
          if (itemCode === "ITEM-2") return 15;
          return null;
        },
      },
    },
  };
}

test("getCurrentSessionOrderCheckoutTransition returns ALLOWED for valid exact-scope draft with READY validation", async () => {
  const result = await getCurrentSessionOrderCheckoutTransition(
    SCOPE,
    createOrderCheckoutTransitionRepository({
      lines: [makeLine({ quantity: 2 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 1 })],
    }),
  );

  assert.deepEqual(result, {
    checkoutTransitionStatus: "ALLOWED",
    canEnterFutureCheckout: true,
    blockingIssues: [],
    transitionSummary: {
      scopedContextStatus: "VALID",
      reviewStatus: "READY",
      reviewValidationStatus: "READY",
      activeLineCount: 2,
      blockingIssueCount: 0,
    },
  });
});

test("getCurrentSessionOrderCheckoutTransition returns BLOCKED for empty order validation blockers", async () => {
  const result = await getCurrentSessionOrderCheckoutTransition(SCOPE, createOrderCheckoutTransitionRepository());

  assert.deepEqual(result, {
    checkoutTransitionStatus: "BLOCKED",
    canEnterFutureCheckout: false,
    blockingIssues: [
      {
        code: "EMPTY_ORDER",
        severity: "BLOCKER",
        message: "Order must contain at least one active line",
      },
    ],
    transitionSummary: {
      scopedContextStatus: "VALID",
      reviewStatus: "READY",
      reviewValidationStatus: "BLOCKED",
      activeLineCount: 0,
      blockingIssueCount: 1,
    },
  });
});

test("getCurrentSessionOrderCheckoutTransition returns BLOCKED for missing-price validation blockers", async () => {
  const result = await getCurrentSessionOrderCheckoutTransition(
    SCOPE,
    createOrderCheckoutTransitionRepository({
      lines: [makeLine({ item_code: "ITEM-UNKNOWN" })],
    }),
  );

  assert.deepEqual(result, {
    checkoutTransitionStatus: "BLOCKED",
    canEnterFutureCheckout: false,
    blockingIssues: [
      {
        code: "ITEM_PRICE_MISSING",
        severity: "BLOCKER",
        message: "One or more active lines cannot be priced",
      },
    ],
    transitionSummary: {
      scopedContextStatus: "VALID",
      reviewStatus: "READY",
      reviewValidationStatus: "BLOCKED",
      activeLineCount: 1,
      blockingIssueCount: 1,
    },
  });
});

test("getCurrentSessionOrderCheckoutTransition denies safely when session is closed", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderCheckoutTransition(
        SCOPE,
        createOrderCheckoutTransitionRepository({
          sessions: [makeSession({ status: "CLOSED" })],
          drafts: [makeDraft()],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderCheckoutTransitionError && error.code === "ORDER_INVALID_OR_CLOSED" && error.status === 403,
  );
});

test("getCurrentSessionOrderCheckoutTransition denies safely when order is non-draft", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderCheckoutTransition(
        SCOPE,
        createOrderCheckoutTransitionRepository({
          drafts: [makeDraft({ status: "CLOSED" as unknown as "DRAFT" })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderCheckoutTransitionError && error.code === "ORDER_INVALID_OR_CLOSED" && error.status === 403,
  );
});

test("getCurrentSessionOrderCheckoutTransition denies safely for mismatched scoped context", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderCheckoutTransition(
        { ...SCOPE, deviceId: "device-2" },
        createOrderCheckoutTransitionRepository(),
      ),
    (error: unknown) =>
      error instanceof PosOrderCheckoutTransitionError && error.code === "ORDER_INVALID_OR_CLOSED" && error.status === 403,
  );
});

test("getCurrentSessionOrderCheckoutTransition never leaks cross-session or cross-device lines", async () => {
  const result = await getCurrentSessionOrderCheckoutTransition(
    SCOPE,
    createOrderCheckoutTransitionRepository({
      lines: [
        makeLine({ id: "line-valid", quantity: 1 }),
        makeLine({ id: "line-other-session", session_id: "session-2", quantity: 7 }),
        makeLine({ id: "line-other-device", device_id: "device-2", quantity: 8 }),
      ],
    }),
  );

  assert.equal(result.checkoutTransitionStatus, "ALLOWED");
  assert.equal(result.transitionSummary.activeLineCount, 1);
  assert.deepEqual(result.blockingIssues, []);
});

test("getCurrentSessionOrderCheckoutTransition is deterministic for the same scoped snapshot", async () => {
  const repository = createOrderCheckoutTransitionRepository({
    lines: [makeLine({ id: "line-1", quantity: 2 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 3 })],
  });

  const first = await getCurrentSessionOrderCheckoutTransition(SCOPE, repository);
  const second = await getCurrentSessionOrderCheckoutTransition(SCOPE, repository);

  assert.deepEqual(second, first);
});

test("getCurrentSessionOrderCheckoutTransition regression: transition payload never mixes sequential scoped reads", async () => {
  const session = makeSession();
  const draft = makeDraft();
  let scopedLineReadCount = 0;
  const firstSnapshot = [makeLine({ id: "line-first", quantity: 1 })];
  const secondSnapshot = [makeLine({ id: "line-second", quantity: 9 })];

  const result = await getCurrentSessionOrderCheckoutTransition(SCOPE, {
    reviewValidationRepository: {
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
          scopedLineReadCount += 1;
          return scopedLineReadCount === 1 ? firstSnapshot : secondSnapshot;
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
        getPriceForItem() {
          return 10;
        },
      },
    },
  });

  assert.equal(scopedLineReadCount, 1);
  assert.equal(result.transitionSummary.activeLineCount, 1);
  assert.equal(result.checkoutTransitionStatus, "ALLOWED");
  assert.deepEqual(result.blockingIssues, []);
});

test("getCurrentSessionOrderCheckoutTransition summary consistency aligns with bounded blocker/result set", async () => {
  const result = await getCurrentSessionOrderCheckoutTransition(
    SCOPE,
    createOrderCheckoutTransitionRepository({
      lines: [makeLine({ item_code: "ITEM-UNKNOWN" })],
    }),
  );

  assert.equal(result.checkoutTransitionStatus, "BLOCKED");
  assert.equal(result.canEnterFutureCheckout, false);
  assert.equal(result.transitionSummary.blockingIssueCount, result.blockingIssues.length);
  assert.equal(result.transitionSummary.reviewValidationStatus, "BLOCKED");
});
