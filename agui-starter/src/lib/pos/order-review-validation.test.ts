import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";
import { createInMemoryPosOrderDraftRepository } from "./order-draft";
import { type OrderLine, createInMemoryPosOrderLineRepository } from "./order-line";
import {
  PosOrderReviewValidationError,
  getCurrentSessionOrderReviewValidation,
} from "./order-review-validation";

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

function createOrderReviewValidationRepository(input?: { sessions?: PosSessionRow[]; drafts?: OrderDraft[]; lines?: OrderLine[] }) {
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
      getPriceForItem(itemCode: string) {
        if (itemCode === "ITEM-1") return 10;
        if (itemCode === "ITEM-2") return 15;
        return null;
      },
    },
  };
}

test("getCurrentSessionOrderReviewValidation returns READY for a valid exact-scope draft", async () => {
  const result = await getCurrentSessionOrderReviewValidation(
    SCOPE,
    createOrderReviewValidationRepository({
      lines: [makeLine({ quantity: 2 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 1 })],
    }),
  );

  assert.deepEqual(result, {
    reviewValidationStatus: "READY",
    isReadyForFutureCheckout: true,
    blockingIssues: [],
    validationSummary: {
      scopedContextStatus: "VALID",
      activeLineCount: 2,
      pricingStatus: "RESOLVED",
      blockingIssueCount: 0,
    },
  });
});

test("getCurrentSessionOrderReviewValidation returns not-ready for empty active lines", async () => {
  const result = await getCurrentSessionOrderReviewValidation(SCOPE, createOrderReviewValidationRepository());

  assert.deepEqual(result, {
    reviewValidationStatus: "BLOCKED",
    isReadyForFutureCheckout: false,
    blockingIssues: [{ code: "EMPTY_ORDER" }],
    validationSummary: {
      scopedContextStatus: "VALID",
      activeLineCount: 0,
      pricingStatus: "UNRESOLVED",
      blockingIssueCount: 1,
    },
  });
});

test("getCurrentSessionOrderReviewValidation fails safely when session is closed", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderReviewValidation(
        SCOPE,
        createOrderReviewValidationRepository({
          sessions: [makeSession({ status: "CLOSED" })],
          drafts: [makeDraft()],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderReviewValidationError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("getCurrentSessionOrderReviewValidation fails safely when order is not draft", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderReviewValidation(
        SCOPE,
        createOrderReviewValidationRepository({
          drafts: [makeDraft({ status: "CLOSED" as unknown as "DRAFT" })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderReviewValidationError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("getCurrentSessionOrderReviewValidation fails safely for mismatched scope", async () => {
  await assert.rejects(
    () => getCurrentSessionOrderReviewValidation({ ...SCOPE, deviceId: "device-2" }, createOrderReviewValidationRepository()),
    (error: unknown) =>
      error instanceof PosOrderReviewValidationError &&
      error.code === "ORDER_INVALID_OR_CLOSED" &&
      error.status === 403,
  );
});

test("getCurrentSessionOrderReviewValidation returns not-ready when pricing is missing", async () => {
  const result = await getCurrentSessionOrderReviewValidation(
    SCOPE,
    createOrderReviewValidationRepository({
      lines: [makeLine({ item_code: "ITEM-UNKNOWN", quantity: 1 })],
    }),
  );

  assert.deepEqual(result, {
    reviewValidationStatus: "BLOCKED",
    isReadyForFutureCheckout: false,
    blockingIssues: [{ code: "ITEM_PRICE_MISSING" }],
    validationSummary: {
      scopedContextStatus: "VALID",
      activeLineCount: 1,
      pricingStatus: "UNRESOLVED",
      blockingIssueCount: 1,
    },
  });
});

test("getCurrentSessionOrderReviewValidation never leaks cross-session or cross-device lines", async () => {
  const result = await getCurrentSessionOrderReviewValidation(
    SCOPE,
    createOrderReviewValidationRepository({
      lines: [
        makeLine({ id: "line-valid", quantity: 1 }),
        makeLine({ id: "line-other-session", session_id: "session-2", quantity: 5 }),
        makeLine({ id: "line-other-device", device_id: "device-2", quantity: 6 }),
      ],
    }),
  );

  assert.equal(result.validationSummary.activeLineCount, 1);
  assert.equal(result.reviewValidationStatus, "READY");
});

test("getCurrentSessionOrderReviewValidation is deterministic for the same scoped snapshot", async () => {
  const repository = createOrderReviewValidationRepository({
    lines: [makeLine({ id: "line-1", item_code: "ITEM-1", quantity: 2 })],
  });

  const first = await getCurrentSessionOrderReviewValidation(SCOPE, repository);
  const second = await getCurrentSessionOrderReviewValidation(SCOPE, repository);

  assert.deepEqual(first, second);
});
