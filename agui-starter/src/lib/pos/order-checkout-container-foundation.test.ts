import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";
import { createInMemoryPosOrderDraftRepository } from "./order-draft";
import type { OrderLine } from "./order-line";
import { createInMemoryPosOrderLineRepository } from "./order-line";
import {
  PosOrderCheckoutContainerFoundationError,
  createOrderCheckoutContainerFoundationRepository,
  getCurrentSessionOrderCheckoutContainerFoundation,
} from "./order-checkout-container-foundation";
import { PosOrderCheckoutEntryError, type OrderCheckoutEntryResult } from "./order-checkout-entry";

type FoundationScope = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

const SCOPE: FoundationScope = {
  houseId: "house-1",
  branchId: "branch-1",
  sessionId: "session-1",
  deviceId: "device-1",
  orderId: "order-1",
} as const;

function makeEntryResult(overrides: Partial<OrderCheckoutEntryResult> = {}): OrderCheckoutEntryResult {
  return {
    checkoutEntryStatus: "ENTERABLE",
    canEnterCheckoutBoundary: true,
    blockingIssues: [],
    entrySummary: {
      scopedContextStatus: "VALID",
      reviewValidationStatus: "READY",
      checkoutTransitionStatus: "ALLOWED",
      activeLineCount: 1,
      blockingIssueCount: 0,
    },
    ...overrides,
  };
}

function createRepository(input?: { checkoutEntry?: OrderCheckoutEntryResult; entryScope?: FoundationScope }) {
  const checkoutEntry = input?.checkoutEntry ?? makeEntryResult();
  const entryScope = input?.entryScope ?? SCOPE;

  return {
    async getCheckoutEntrySnapshot() {
      return { checkoutEntry, entryScope: { ...entryScope } };
    },
  };
}

function makeSession(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  const now = new Date().toISOString();
  return {
    id: SCOPE.sessionId,
    house_id: SCOPE.houseId,
    branch_id: SCOPE.branchId,
    device_id: SCOPE.deviceId,
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
    id: SCOPE.orderId,
    house_id: SCOPE.houseId,
    branch_id: SCOPE.branchId,
    session_id: SCOPE.sessionId,
    device_id: SCOPE.deviceId,
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
    order_id: SCOPE.orderId,
    house_id: SCOPE.houseId,
    branch_id: SCOPE.branchId,
    session_id: SCOPE.sessionId,
    device_id: SCOPE.deviceId,
    operator_entity_id: "entity-1",
    item_code: "ITEM-1",
    quantity: 1,
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createCheckoutEntryRepository(input?: { sessions?: PosSessionRow[]; drafts?: OrderDraft[]; lines?: OrderLine[] }) {
  const sessions = input?.sessions ?? [makeSession()];
  const drafts = input?.drafts ?? [makeDraft()];
  const lines = input?.lines ?? [makeLine({ quantity: 2 })];
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
            return null;
          },
        },
      },
    },
  };
}


test("missing repository throws structured Slice 7A foundation error", async () => {
  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerFoundation(SCOPE),
    (error: unknown) =>
      error instanceof PosOrderCheckoutContainerFoundationError &&
      error.code === "ORDER_CHECKOUT_CONTAINER_FOUNDATION_REPOSITORY_REQUIRED" &&
      error.status === 500,
  );
});

test("default repository happy path remains FOUNDATIONAL when Slice 6 is ENTERABLE", async () => {
  const repository = createOrderCheckoutContainerFoundationRepository(createCheckoutEntryRepository());
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);

  assert.equal(result.containerFoundationStatus, "FOUNDATIONAL");
  assert.equal(result.canDefineCheckoutContainer, true);
  assert.deepEqual(result.containerAnchorSummary, SCOPE);
});


test("default repository maps upstream scope denial to BLOCKED without leakage", async () => {
  const repository = createOrderCheckoutContainerFoundationRepository(
    createCheckoutEntryRepository({ sessions: [makeSession()], drafts: [makeDraft()] }),
  );

  const result = await getCurrentSessionOrderCheckoutContainerFoundation({ ...SCOPE, sessionId: "session-foreign" }, repository);

  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.canDefineCheckoutContainer, false);
  assert.deepEqual(result.containerAnchorSummary, { ...SCOPE, sessionId: "session-foreign" });
  assert.deepEqual(result.blockingIssues, [
    {
      code: "CHECKOUT_CONTAINER_FOUNDATION_BLOCKED",
      severity: "BLOCKER",
      message: "Checkout container foundation is blocked by checkout entry decision.",
    },
  ]);
  assert.equal(result.blockingIssues[0]?.message.includes("ORDER_INVALID_OR_CLOSED"), false);
  assert.equal(result.blockingIssues[0]?.message.includes("invalid"), false);
});



test("ORDER_INVALID_OR_CLOSED maps to BLOCKED", async () => {
  const repository = {
    async getCheckoutEntrySnapshot() {
      throw new PosOrderCheckoutEntryError("denied", "ORDER_INVALID_OR_CLOSED", 403);
    },
  };

  const result = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);
  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.deepEqual(result.blockingIssues, [
    {
      code: "CHECKOUT_CONTAINER_FOUNDATION_BLOCKED",
      severity: "BLOCKER",
      message: "Checkout container foundation is blocked by checkout entry decision.",
    },
  ]);
});

test("ORDER_CHECKOUT_ENTRY_ERROR with status 400 is rethrown", async () => {
  const repository = {
    async getCheckoutEntrySnapshot() {
      throw new PosOrderCheckoutEntryError("bad request", "ORDER_CHECKOUT_ENTRY_ERROR", 400);
    },
  };

  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError &&
      error.status === 400 &&
      error.code === "ORDER_CHECKOUT_ENTRY_ERROR",
  );
});

test("ORDER_CHECKOUT_ENTRY_REPOSITORY_REQUIRED with status 500 is rethrown", async () => {
  const repository = {
    async getCheckoutEntrySnapshot() {
      throw new PosOrderCheckoutEntryError(
        "repo missing",
        "ORDER_CHECKOUT_ENTRY_REPOSITORY_REQUIRED",
        500,
      );
    },
  };

  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError &&
      error.status === 500 &&
      error.code === "ORDER_CHECKOUT_ENTRY_REPOSITORY_REQUIRED",
  );
});

test("unknown 400 PosOrderCheckoutEntryError is rethrown", async () => {
  const repository = {
    async getCheckoutEntrySnapshot() {
      throw new PosOrderCheckoutEntryError("unknown 400", "ORDER_SCOPE_UNKNOWN", 400);
    },
  };

  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError && error.status === 400 && error.code === "ORDER_SCOPE_UNKNOWN",
  );
});

test("403 maps only with explicit safe code; otherwise rethrows", async () => {
  const safeRepository = {
    async getCheckoutEntrySnapshot() {
      throw new PosOrderCheckoutEntryError("denied", "ORDER_INVALID_OR_CLOSED", 403);
    },
  };

  const safeResult = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, safeRepository);
  assert.equal(safeResult.containerFoundationStatus, "BLOCKED");

  const unsafeRepository = {
    async getCheckoutEntrySnapshot() {
      throw new PosOrderCheckoutEntryError("denied", "ORDER_SCOPE_403_UNKNOWN", 403);
    },
  };

  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, unsafeRepository),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError && error.status === 403 && error.code === "ORDER_SCOPE_403_UNKNOWN",
  );
});

test("Slice 6 operational 500 entry error is rethrown", async () => {
  const repository = {
    async getCheckoutEntrySnapshot() {
      throw new PosOrderCheckoutEntryError("repository unavailable", "ORDER_CHECKOUT_ENTRY_ERROR", 500);
    },
  };

  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository),
    (error: unknown) =>
      error instanceof PosOrderCheckoutEntryError &&
      error.status === 500 &&
      error.code === "ORDER_CHECKOUT_ENTRY_ERROR",
  );
});

test("unknown non-domain error is rethrown", async () => {
  const repository = {
    async getCheckoutEntrySnapshot() {
      throw new Error("unexpected boom");
    },
  };

  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository),
    (error: unknown) => error instanceof Error && error.message === "unexpected boom",
  );
});

test("FOUNDATIONAL when Slice 6 is ENTERABLE and scope is coherent", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, createRepository());

  assert.deepEqual(result, {
    containerFoundationStatus: "FOUNDATIONAL",
    canDefineCheckoutContainer: true,
    containerAnchorSummary: SCOPE,
    blockingIssues: [],
  });
});

test("BLOCKED when Slice 6 is BLOCKED", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(
    SCOPE,
    createRepository({
      checkoutEntry: makeEntryResult({
        checkoutEntryStatus: "BLOCKED",
        canEnterCheckoutBoundary: false,
        blockingIssues: [{ code: "EMPTY_ORDER", severity: "BLOCKER", message: "x" }],
      }),
    }),
  );

  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.canDefineCheckoutContainer, false);
  assert.deepEqual(result.blockingIssues, [
    {
      code: "CHECKOUT_CONTAINER_FOUNDATION_BLOCKED",
      severity: "BLOCKER",
      message: "Checkout container foundation is blocked by checkout entry decision.",
    },
  ]);
});

test("BLOCKED on order mismatch via exported foundation path", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(
    SCOPE,
    createRepository({ entryScope: { ...SCOPE, orderId: "order-2" } }),
  );
  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_ORDER_MISMATCH");
  assert.deepEqual(result.containerAnchorSummary, SCOPE);
  assert.equal(result.containerAnchorSummary.orderId, SCOPE.orderId);
});

test("BLOCKED on session mismatch via exported foundation path", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(
    SCOPE,
    createRepository({ entryScope: { ...SCOPE, sessionId: "session-2" } }),
  );
  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_SESSION_MISMATCH");
});

test("BLOCKED on device mismatch via exported foundation path", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(
    SCOPE,
    createRepository({ entryScope: { ...SCOPE, deviceId: "device-2" } }),
  );
  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_DEVICE_MISMATCH");
});

test("BLOCKED on branch mismatch via exported foundation path", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(
    SCOPE,
    createRepository({ entryScope: { ...SCOPE, branchId: "branch-2" } }),
  );
  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_BRANCH_MISMATCH");
});

test("BLOCKED on house mismatch via exported foundation path", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(
    SCOPE,
    createRepository({ entryScope: { ...SCOPE, houseId: "house-2" } }),
  );
  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_HOUSE_MISMATCH");
  assert.deepEqual(result.containerAnchorSummary, SCOPE);
  assert.equal(result.containerAnchorSummary.houseId, SCOPE.houseId);
});

test("deterministic repeated output", async () => {
  const repository = createRepository();
  const first = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);
  const second = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);
  assert.deepEqual(first, second);
});

test("safe blocker output does not leak repository details", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(
    SCOPE,
    createRepository({ entryScope: { ...SCOPE, orderId: "order-other" } }),
  );

  assert.deepEqual(Object.keys(result.blockingIssues[0] ?? {}).sort(), ["code", "message", "severity"]);
  assert.equal(result.blockingIssues[0]?.message.includes("repository"), false);
  assert.equal(result.blockingIssues[0]?.message.includes("order-other"), false);
});

test("no mutation leakage in blocker output", async () => {
  const repository = createRepository({ entryScope: { ...SCOPE, sessionId: "session-other" } });

  const first = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);
  first.blockingIssues[0]!.message = "mutated";

  const second = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);
  assert.equal(second.blockingIssues[0]?.message, "Checkout container anchor session is out of scope.");
});
