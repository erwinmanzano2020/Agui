import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";
import { createInMemoryPosOrderDraftRepository } from "./order-draft";
import { type OrderLine, createInMemoryPosOrderLineRepository } from "./order-line";
import { __internal, PosOrderCheckoutEntryError, getCurrentSessionOrderCheckoutEntry } from "./order-checkout-entry";

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

function createOrderCheckoutEntryRepository(input?: {
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
    checkoutTransitionRepository: {
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
    },
  };
}

test("getCurrentSessionOrderCheckoutEntry returns ENTERABLE for valid exact-scope draft", async () => {
  const result = await getCurrentSessionOrderCheckoutEntry(
    SCOPE,
    createOrderCheckoutEntryRepository({
      lines: [makeLine({ quantity: 2 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 1 })],
    }),
  );

  assert.deepEqual(result, {
    checkoutEntryStatus: "ENTERABLE",
    canEnterCheckoutBoundary: true,
    blockingIssues: [],
    entrySummary: {
      scopedContextStatus: "VALID",
      reviewValidationStatus: "READY",
      checkoutTransitionStatus: "ALLOWED",
      activeLineCount: 2,
      blockingIssueCount: 0,
    },
  });
});

test("getCurrentSessionOrderCheckoutEntry returns BLOCKED for empty-order blocker", async () => {
  const result = await getCurrentSessionOrderCheckoutEntry(SCOPE, createOrderCheckoutEntryRepository());

  assert.deepEqual(result, {
    checkoutEntryStatus: "BLOCKED",
    canEnterCheckoutBoundary: false,
    blockingIssues: [
      {
        code: "EMPTY_ORDER",
        severity: "BLOCKER",
        message: "Order must contain at least one active line",
      },
    ],
    entrySummary: {
      scopedContextStatus: "VALID",
      reviewValidationStatus: "BLOCKED",
      checkoutTransitionStatus: "BLOCKED",
      activeLineCount: 0,
      blockingIssueCount: 1,
    },
  });
});

test("getCurrentSessionOrderCheckoutEntry returns BLOCKED for missing-price blocker", async () => {
  const result = await getCurrentSessionOrderCheckoutEntry(
    SCOPE,
    createOrderCheckoutEntryRepository({
      lines: [makeLine({ item_code: "ITEM-UNKNOWN" })],
    }),
  );

  assert.deepEqual(result, {
    checkoutEntryStatus: "BLOCKED",
    canEnterCheckoutBoundary: false,
    blockingIssues: [
      {
        code: "ITEM_PRICE_MISSING",
        severity: "BLOCKER",
        message: "One or more active lines cannot be priced",
      },
    ],
    entrySummary: {
      scopedContextStatus: "VALID",
      reviewValidationStatus: "BLOCKED",
      checkoutTransitionStatus: "BLOCKED",
      activeLineCount: 1,
      blockingIssueCount: 1,
    },
  });
});

test("getCurrentSessionOrderCheckoutEntry denies safely for closed session", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderCheckoutEntry(
        SCOPE,
        createOrderCheckoutEntryRepository({
          sessions: [makeSession({ status: "CLOSED" })],
          drafts: [makeDraft()],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError && error.code === "ORDER_INVALID_OR_CLOSED" && error.status === 403,
  );
});

test("getCurrentSessionOrderCheckoutEntry denies safely for non-draft order", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderCheckoutEntry(
        SCOPE,
        createOrderCheckoutEntryRepository({
          drafts: [makeDraft({ status: "CLOSED" as unknown as "DRAFT" })],
        }),
      ),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError && error.code === "ORDER_INVALID_OR_CLOSED" && error.status === 403,
  );
});

test("getCurrentSessionOrderCheckoutEntry denies safely for mismatched scope", async () => {
  await assert.rejects(
    () =>
      getCurrentSessionOrderCheckoutEntry(
        { ...SCOPE, deviceId: "device-2" },
        createOrderCheckoutEntryRepository(),
      ),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError && error.code === "ORDER_INVALID_OR_CLOSED" && error.status === 403,
  );
});

test("getCurrentSessionOrderCheckoutEntry never leaks cross-session or cross-device lines", async () => {
  const result = await getCurrentSessionOrderCheckoutEntry(
    SCOPE,
    createOrderCheckoutEntryRepository({
      lines: [
        makeLine({ id: "line-valid", quantity: 1 }),
        makeLine({ id: "line-other-session", session_id: "session-2", quantity: 7 }),
        makeLine({ id: "line-other-device", device_id: "device-2", quantity: 8 }),
      ],
    }),
  );

  assert.equal(result.checkoutEntryStatus, "ENTERABLE");
  assert.equal(result.entrySummary.activeLineCount, 1);
  assert.deepEqual(result.blockingIssues, []);
});

test("getCurrentSessionOrderCheckoutEntry is deterministic for the same scoped snapshot", async () => {
  const repository = createOrderCheckoutEntryRepository({
    lines: [makeLine({ id: "line-1", quantity: 2 }), makeLine({ id: "line-2", item_code: "ITEM-2", quantity: 3 })],
  });

  const first = await getCurrentSessionOrderCheckoutEntry(SCOPE, repository);
  const second = await getCurrentSessionOrderCheckoutEntry(SCOPE, repository);

  assert.deepEqual(second, first);
});

test("getCurrentSessionOrderCheckoutEntry summary consistency aligns with blocker set length", async () => {
  const result = await getCurrentSessionOrderCheckoutEntry(
    SCOPE,
    createOrderCheckoutEntryRepository({
      lines: [makeLine({ item_code: "ITEM-UNKNOWN" })],
    }),
  );

  assert.equal(result.checkoutEntryStatus, "BLOCKED");
  assert.equal(result.canEnterCheckoutBoundary, false);
  assert.equal(result.entrySummary.blockingIssueCount, result.blockingIssues.length);
});

test("getCurrentSessionOrderCheckoutEntry always returns complete contract fields", async () => {
  const result = await getCurrentSessionOrderCheckoutEntry(SCOPE, createOrderCheckoutEntryRepository());

  assert.ok("checkoutEntryStatus" in result);
  assert.ok("canEnterCheckoutBoundary" in result);
  assert.ok("blockingIssues" in result);
  assert.ok("entrySummary" in result);
  assert.ok(Array.isArray(result.blockingIssues));
  assert.equal(typeof result.entrySummary.scopedContextStatus, "string");
  assert.equal(typeof result.entrySummary.reviewValidationStatus, "string");
  assert.equal(typeof result.entrySummary.checkoutTransitionStatus, "string");
  assert.equal(typeof result.entrySummary.activeLineCount, "number");
  assert.equal(typeof result.entrySummary.blockingIssueCount, "number");
});

test("getCurrentSessionOrderCheckoutEntry enforces symmetry between entry status and blocker list", async () => {
  const enterable = await getCurrentSessionOrderCheckoutEntry(
    SCOPE,
    createOrderCheckoutEntryRepository({ lines: [makeLine()] }),
  );
  assert.equal(enterable.checkoutEntryStatus, "ENTERABLE");
  assert.equal(enterable.blockingIssues.length, 0);
  assert.equal(enterable.entrySummary.blockingIssueCount, enterable.blockingIssues.length);

  const blocked = await getCurrentSessionOrderCheckoutEntry(SCOPE, createOrderCheckoutEntryRepository());
  assert.equal(blocked.checkoutEntryStatus, "BLOCKED");
  assert.ok(blocked.blockingIssues.length > 0);
  assert.equal(blocked.entrySummary.blockingIssueCount, blocked.blockingIssues.length);
});

test("createEntryResult returns safe fallback blocker when upstream transition is BLOCKED with empty blockers", () => {
  const result = __internal.createEntryResult({
    checkoutTransition: {
      checkoutTransitionStatus: "BLOCKED",
      canEnterFutureCheckout: false,
      blockingIssues: [],
      transitionSummary: {
        scopedContextStatus: "VALID",
        reviewStatus: "READY",
        reviewValidationStatus: "BLOCKED",
        activeLineCount: 1,
        blockingIssueCount: 0,
      },
    },
  });

  assert.equal(result.checkoutEntryStatus, "BLOCKED");
  assert.equal(result.canEnterCheckoutBoundary, false);
  assert.deepEqual(result.blockingIssues, [
    {
      code: "CHECKOUT_ENTRY_BLOCKED",
      severity: "BLOCKER",
      message: "Checkout entry is not available for this order.",
    },
  ]);
  assert.equal(result.entrySummary.blockingIssueCount, result.blockingIssues.length);
});

test("getCurrentSessionOrderCheckoutEntry never mixes snapshots when upstream state mutates between reads", async () => {
  const session = makeSession();
  const draft = makeDraft();
  let scopedLineReadCount = 0;
  const firstSnapshot = [makeLine({ id: "line-first", quantity: 1 })];
  const secondSnapshot = [makeLine({ id: "line-second", quantity: 9 })];

  const result = await getCurrentSessionOrderCheckoutEntry(SCOPE, {
    checkoutTransitionRepository: {
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
    },
  });

  assert.equal(scopedLineReadCount, 1);
  assert.equal(result.entrySummary.activeLineCount, 1);
  assert.equal(result.checkoutEntryStatus, "ENTERABLE");
  assert.deepEqual(result.blockingIssues, []);
});

test("getCurrentSessionOrderCheckoutEntry treats ALLOWED transition as canonical ENTERABLE contract", async () => {
  const result = await getCurrentSessionOrderCheckoutEntry(SCOPE, {
    checkoutTransitionRepository: {
      reviewValidationRepository: {
        draftRepository: {
          async getSessionById() {
            return makeSession();
          },
          async getDraftOrderById() {
            return makeDraft();
          },
          async insertOrderDraft() {
            throw new Error("not used");
          },
        },
        lineRepository: {
          async getSessionById() {
            return makeSession();
          },
          async getOrderDraftById() {
            return makeDraft();
          },
          async getOrderLinesByDraft() {
            return [makeLine()];
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
    },
  });

  assert.equal(result.checkoutEntryStatus, "ENTERABLE");
  assert.equal(result.canEnterCheckoutBoundary, true);
  assert.equal(result.entrySummary.checkoutTransitionStatus, "ALLOWED");
});

test("getCurrentSessionOrderCheckoutEntry copies blocker output to prevent mutation leakage", async () => {
  const repository = createOrderCheckoutEntryRepository();
  const first = await getCurrentSessionOrderCheckoutEntry(SCOPE, repository);
  assert.equal(first.checkoutEntryStatus, "BLOCKED");
  assert.equal(first.blockingIssues.length, 1);

  first.blockingIssues[0]!.message = "mutated";

  const second = await getCurrentSessionOrderCheckoutEntry(SCOPE, repository);
  assert.equal(second.blockingIssues[0]!.message, "Order must contain at least one active line");
  assert.equal(second.entrySummary.blockingIssueCount, second.blockingIssues.length);
});
