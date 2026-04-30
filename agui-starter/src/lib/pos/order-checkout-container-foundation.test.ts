import assert from "node:assert/strict";
import test from "node:test";

import type { OrderCheckoutEntryResult } from "./order-checkout-entry";
import { __internal, getCurrentSessionOrderCheckoutContainerFoundation } from "./order-checkout-container-foundation";

const SCOPE = {
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

function createRepository(checkoutEntry: OrderCheckoutEntryResult) {
  return {
    async getCheckoutEntry() {
      return checkoutEntry;
    },
  };
}

test("FOUNDATIONAL when Slice 6 is ENTERABLE and scope is coherent", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, createRepository(makeEntryResult()));

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
    createRepository(
      makeEntryResult({
        checkoutEntryStatus: "BLOCKED",
        canEnterCheckoutBoundary: false,
        blockingIssues: [{ code: "EMPTY_ORDER", severity: "BLOCKER", message: "x" }],
      }),
    ),
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

test("BLOCKED on order mismatch", () => {
  const result = __internal.createContainerFoundationResult({
    requestedScope: SCOPE,
    entryScope: { ...SCOPE, orderId: "order-2" },
    checkoutEntry: makeEntryResult(),
  });

  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_ORDER_MISMATCH");
});

test("BLOCKED on session mismatch", () => {
  const result = __internal.createContainerFoundationResult({
    requestedScope: SCOPE,
    entryScope: { ...SCOPE, sessionId: "session-2" },
    checkoutEntry: makeEntryResult(),
  });

  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_SESSION_MISMATCH");
});

test("BLOCKED on device mismatch", () => {
  const result = __internal.createContainerFoundationResult({
    requestedScope: SCOPE,
    entryScope: { ...SCOPE, deviceId: "device-2" },
    checkoutEntry: makeEntryResult(),
  });

  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_CONTAINER_ANCHOR_DEVICE_MISMATCH");
});

test("BLOCKED on branch and house mismatch", () => {
  const result = __internal.createContainerFoundationResult({
    requestedScope: SCOPE,
    entryScope: { ...SCOPE, branchId: "branch-2", houseId: "house-2" },
    checkoutEntry: makeEntryResult(),
  });

  assert.equal(result.containerFoundationStatus, "BLOCKED");
  assert.deepEqual(result.blockingIssues.map((issue) => issue.code), [
    "CHECKOUT_CONTAINER_ANCHOR_BRANCH_MISMATCH",
    "CHECKOUT_CONTAINER_ANCHOR_HOUSE_MISMATCH",
  ]);
});

test("deterministic repeated output", async () => {
  const repository = createRepository(makeEntryResult());

  const first = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);
  const second = await getCurrentSessionOrderCheckoutContainerFoundation(SCOPE, repository);

  assert.deepEqual(first, second);
});

test("safe blocker output does not leak repository details", () => {
  const result = __internal.createContainerFoundationResult({
    requestedScope: SCOPE,
    entryScope: { ...SCOPE, orderId: "order-other" },
    checkoutEntry: makeEntryResult(),
  });

  assert.deepEqual(Object.keys(result.blockingIssues[0] ?? {}).sort(), ["code", "message", "severity"]);
  assert.equal(result.blockingIssues[0]?.message.includes("repository"), false);
});

test("no mutation leakage in blocker output", () => {
  const first = __internal.createContainerFoundationResult({
    requestedScope: SCOPE,
    entryScope: { ...SCOPE, sessionId: "session-other" },
    checkoutEntry: makeEntryResult(),
  });

  first.blockingIssues[0]!.message = "mutated";

  const second = __internal.createContainerFoundationResult({
    requestedScope: SCOPE,
    entryScope: { ...SCOPE, sessionId: "session-other" },
    checkoutEntry: makeEntryResult(),
  });

  assert.equal(second.blockingIssues[0]?.message, "Checkout container anchor session is out of scope.");
});
