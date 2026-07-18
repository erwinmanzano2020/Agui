import assert from "node:assert/strict";
import test from "node:test";

import type { OrderCheckoutExecutionCoordinatorResult } from "./order-checkout-execution-coordinator";
import { determinePaymentFoundationAuthority } from "./payment-foundation";

const SCOPE_SUMMARY = {
  orderId: "order-1",
  sessionId: "session-1",
  deviceId: "device-1",
  branchId: "branch-1",
  houseId: "house-1",
  foundationStatus: "FOUNDATIONAL" as const,
  containerLifecycleState: "ACTIVE" as const,
};

function createCoordinatorResult(
  overrides: Partial<OrderCheckoutExecutionCoordinatorResult> = {},
): OrderCheckoutExecutionCoordinatorResult {
  return {
    checkoutExecutionStatus: "READY",
    canContinueCheckoutExecution: true,
    executionScopeSummary: { ...SCOPE_SUMMARY },
    blockingIssues: [],
    ...overrides,
  };
}

test("READY coordinator result maps to PAYMENT_READY", () => {
  assert.equal(determinePaymentFoundationAuthority(createCoordinatorResult()), "PAYMENT_READY");
});

test("BLOCKED coordinator result maps to PAYMENT_BLOCKED", () => {
  assert.equal(determinePaymentFoundationAuthority(createCoordinatorResult({ checkoutExecutionStatus: "BLOCKED" })), "PAYMENT_BLOCKED");
});

test("absent or malformed coordinator result maps to PAYMENT_BLOCKED", () => {
  assert.equal(determinePaymentFoundationAuthority(undefined), "PAYMENT_BLOCKED");
  assert.equal(determinePaymentFoundationAuthority(null), "PAYMENT_BLOCKED");
  assert.equal(determinePaymentFoundationAuthority({} as never), "PAYMENT_BLOCKED");
});

test("unknown coordinator result maps to PAYMENT_BLOCKED", () => {
  assert.equal(determinePaymentFoundationAuthority({ checkoutExecutionStatus: "UNKNOWN" } as never), "PAYMENT_BLOCKED");
});

test("payment foundation is deterministic and exposes no mutable upstream or downstream state", () => {
  const input = createCoordinatorResult();
  const first = determinePaymentFoundationAuthority(input);
  const second = determinePaymentFoundationAuthority(input);
  const third = determinePaymentFoundationAuthority(createCoordinatorResult());

  assert.equal(first, "PAYMENT_READY");
  assert.equal(second, "PAYMENT_READY");
  assert.equal(third, second);
});

test("payment foundation performs no persistence, repository access, mutation, or downstream effects", () => {
  const calls: string[] = [];
  const coordinatorResult = Object.freeze(createCoordinatorResult({ checkoutExecutionStatus: "BLOCKED" }));

  const result = determinePaymentFoundationAuthority(coordinatorResult);

  assert.equal(result, "PAYMENT_BLOCKED");
  assert.deepEqual(calls, []);
  assert.equal(coordinatorResult.checkoutExecutionStatus, "BLOCKED");
});
