import assert from "node:assert/strict";
import test from "node:test";

import { mapPosSessionClientError } from "./error-messages";
import {
  createEmptyOrderReview,
  createEmptyOrderPricing,
  clearLineSurfaceState,
  parseQuantityInput,
  resolveCurrentOrderScope,
  resolveInitialBranchId,
  serializeCurrentOrderScope,
  shouldApplyLineRefreshResult,
  shouldApplyPricingRefreshResult,
  shouldApplyReviewRefreshResult,
  shouldRefreshPricingAfterLineRefresh,
} from "./session-client";
import { PosSessionAuthError } from "@/lib/pos/session-auth";

const INTERNAL_CODES = [
  "INVALID_OPERATOR_CREDENTIALS",
  "DEVICE_UNAVAILABLE",
  "DEVICE_SCOPE_DENIED",
  "SESSION_ALREADY_OPEN",
  "SESSION_NOT_FOUND",
  "SESSION_SCOPE_DENIED",
] as const;

test("resolveInitialBranchId does not invent a house-id fallback", () => {
  assert.equal(resolveInitialBranchId(null), "");
  assert.equal(resolveInitialBranchId(""), "");
  assert.equal(resolveInitialBranchId("branch-1"), "branch-1");
});

test("resolveCurrentOrderScope only returns a session-bound scope when all ids are present", () => {
  assert.equal(
    resolveCurrentOrderScope({
      branchId: "branch-1",
      sessionId: "",
      deviceId: "device-1",
      orderId: "order-1",
    }),
    null,
  );

  assert.deepEqual(
    resolveCurrentOrderScope({
      branchId: " branch-1 ",
      sessionId: " session-1 ",
      deviceId: " device-1 ",
      orderId: " order-1 ",
    }),
    {
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
    },
  );
});

test("parseQuantityInput keeps page quantity parsing conservative", () => {
  assert.equal(parseQuantityInput(""), null);
  assert.equal(parseQuantityInput("not-a-number"), null);
  assert.equal(parseQuantityInput("2"), 2);
  assert.equal(parseQuantityInput(" 3.5 "), 3.5);
});

test("stale refresh guard rejects out-of-order and stale-scope responses", () => {
  const oldScopeKey = serializeCurrentOrderScope({
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
  });
  const newScopeKey = serializeCurrentOrderScope({
    branchId: "branch-1",
    sessionId: "session-2",
    deviceId: "device-2",
    orderId: "order-2",
  });

  assert.equal(
    shouldApplyLineRefreshResult({
      requestedScopeKey: oldScopeKey,
      activeScopeKey: newScopeKey,
      requestId: 1,
      latestRequestId: 2,
    }),
    false,
  );

  assert.equal(
    shouldApplyLineRefreshResult({
      requestedScopeKey: oldScopeKey,
      activeScopeKey: newScopeKey,
      requestId: 2,
      latestRequestId: 2,
    }),
    false,
  );

  assert.equal(
    shouldApplyLineRefreshResult({
      requestedScopeKey: newScopeKey,
      activeScopeKey: newScopeKey,
      requestId: 3,
      latestRequestId: 3,
    }),
    true,
  );
});

test("failed scoped line fetch path remains conservative and clears stale dependent state inputs", () => {
  assert.equal(
    shouldApplyLineRefreshResult({
      requestedScopeKey: "",
      activeScopeKey: "branch-1::session-1::device-1::order-1",
      requestId: 4,
      latestRequestId: 4,
    }),
    false,
  );

  assert.deepEqual(clearLineSurfaceState(), { lines: [], lineEdits: {} });
  assert.deepEqual(createEmptyOrderPricing(), { subtotal: 0, tax: 0, total: 0, currency: "USD" });
});

test("pricing refresh follows the same stale scope guard and does not compute totals client-side", () => {
  const scopeKey = "branch-1::session-1::device-1::order-1";
  assert.equal(
    shouldApplyPricingRefreshResult({
      requestedScopeKey: scopeKey,
      activeScopeKey: scopeKey,
      requestId: 2,
      latestRequestId: 2,
    }),
    true,
  );
  assert.equal(
    shouldApplyPricingRefreshResult({
      requestedScopeKey: scopeKey,
      activeScopeKey: "",
      requestId: 2,
      latestRequestId: 2,
    }),
    false,
  );
});

test("stale review refresh results are dropped unless request and scope still match", () => {
  const scopeKey = "branch-1::session-1::device-1::order-1";
  assert.equal(
    shouldApplyReviewRefreshResult({
      requestedScopeKey: scopeKey,
      activeScopeKey: scopeKey,
      requestId: 9,
      latestRequestId: 9,
    }),
    true,
  );
  assert.equal(
    shouldApplyReviewRefreshResult({
      requestedScopeKey: scopeKey,
      activeScopeKey: "branch-1::session-2::device-2::order-2",
      requestId: 9,
      latestRequestId: 10,
    }),
    false,
  );
});

test("empty/no-scope review state remains conservative", () => {
  assert.deepEqual(createEmptyOrderReview(), null);
  assert.equal(
    shouldApplyReviewRefreshResult({
      requestedScopeKey: "",
      activeScopeKey: "branch-1::session-1::device-1::order-1",
      requestId: 1,
      latestRequestId: 1,
    }),
    false,
  );
});

test("review layer does not introduce any client-side pricing recomputation helper", () => {
  const reviewState = createEmptyOrderReview();
  const pricingState = createEmptyOrderPricing();
  assert.equal(reviewState, null);
  assert.deepEqual(pricingState, { subtotal: 0, tax: 0, total: 0, currency: "USD" });
});

test("stale initial-load flow does not issue pricing refresh after line refresh when scope moved", () => {
  assert.equal(
    shouldRefreshPricingAfterLineRefresh({
      cancelled: false,
      requestedScopeKey: "branch-1::session-1::device-1::order-1",
      activeScopeKey: "branch-1::session-2::device-2::order-2",
    }),
    false,
  );
});

test("newer valid pricing refresh is not invalidated by stale load path follow-up", () => {
  assert.equal(
    shouldRefreshPricingAfterLineRefresh({
      cancelled: false,
      requestedScopeKey: "branch-1::session-1::device-1::order-1",
      activeScopeKey: "branch-1::session-1::device-1::order-1",
    }),
    true,
  );
  assert.equal(
    shouldRefreshPricingAfterLineRefresh({
      cancelled: true,
      requestedScopeKey: "branch-1::session-1::device-1::order-1",
      activeScopeKey: "branch-1::session-1::device-1::order-1",
    }),
    false,
  );
});

test("open/close deny codes map to one client-safe no-leak message", () => {
  for (const code of INTERNAL_CODES) {
    const mapped = mapPosSessionClientError(new PosSessionAuthError("internal detail", code, 403));
    assert.equal(mapped, "Unable to complete POS session request.");
  }
});

test("unknown session auth errors still map to a conservative client-safe message", () => {
  const mapped = mapPosSessionClientError(new PosSessionAuthError("unexpected db detail", "SESSION_DB_TIMEOUT", 500));
  assert.equal(mapped, "Unable to complete POS session request.");
});
