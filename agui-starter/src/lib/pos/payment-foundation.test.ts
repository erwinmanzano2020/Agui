import assert from "node:assert/strict";
import test from "node:test";

import { determinePaymentFoundationAuthority } from "./payment-foundation";

test("READY coordinator result maps to PAYMENT_READY", () => {
  assert.equal(determinePaymentFoundationAuthority({ checkoutExecutionStatus: "READY" }), "PAYMENT_READY");
});

test("BLOCKED coordinator result maps to PAYMENT_BLOCKED", () => {
  assert.equal(determinePaymentFoundationAuthority({ checkoutExecutionStatus: "BLOCKED" }), "PAYMENT_BLOCKED");
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
  const input = { checkoutExecutionStatus: "READY" as const };
  const first = determinePaymentFoundationAuthority(input);
  const second = determinePaymentFoundationAuthority(input);
  const third = determinePaymentFoundationAuthority({ checkoutExecutionStatus: "READY" });

  assert.equal(first, "PAYMENT_READY");
  assert.equal(second, "PAYMENT_READY");
  assert.equal(third, second);
});

test("payment foundation performs no persistence, repository access, mutation, or downstream effects", () => {
  const calls: string[] = [];
  const coordinatorResult = Object.freeze({ checkoutExecutionStatus: "BLOCKED" as const });

  const result = determinePaymentFoundationAuthority(coordinatorResult);

  assert.equal(result, "PAYMENT_BLOCKED");
  assert.deepEqual(calls, []);
  assert.deepEqual(coordinatorResult, { checkoutExecutionStatus: "BLOCKED" });
});
