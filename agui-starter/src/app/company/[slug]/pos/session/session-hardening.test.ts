import assert from "node:assert/strict";
import test from "node:test";

import type { OrderCheckoutTransitionResult } from "@/lib/pos/order-checkout-transition";
import type { OrderCheckoutEntryResult } from "@/lib/pos/order-checkout-entry";
import type { OrderReviewValidationResult } from "@/lib/pos/order-review-validation";

import { mapPosSessionClientError } from "./error-messages";
import {
  createEmptyOrderReview,
  createEmptyOrderReviewValidation,
  createEmptyOrderCheckoutTransition,
  createEmptyOrderCheckoutEntry,
  createEmptyOrderPricing,
  getConservativeCheckoutEntryBlockingIssues,
  getConservativeCheckoutTransitionBlockingIssues,
  getConservativeValidationBlockingIssues,
  clearLineSurfaceState,
  parseQuantityInput,
  resolveCurrentOrderScope,
  resolveInitialBranchId,
  serializeCurrentOrderScope,
  shouldApplyLineRefreshResult,
  shouldApplyPricingRefreshResult,
  shouldApplyReviewRefreshResult,
  shouldApplyReviewValidationRefreshResult,
  shouldApplyCheckoutEntryRefreshResult,
  shouldApplyCheckoutTransitionRefreshResult,
  shouldClearReviewForEmptyScope,
  shouldClearCheckoutEntryForEmptyScope,
  shouldClearCheckoutTransitionForEmptyScope,
  shouldClearValidationForEmptyScope,
  shouldRefreshReviewAfterAddLineSuccess,
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

test("empty scoped order key always clears review to canonical empty state", () => {
  assert.equal(shouldClearReviewForEmptyScope(""), true);
  assert.equal(shouldClearReviewForEmptyScope("branch-1::session-1::device-1::order-1"), false);
});

test("empty scoped order key always clears validation to canonical empty state", () => {
  assert.equal(shouldClearValidationForEmptyScope(""), true);
  assert.equal(shouldClearValidationForEmptyScope("branch-1::session-1::device-1::order-1"), false);
});

test("no-scope branch cannot retain previous review payload shape", () => {
  const previousReviewLikePayload = {
    reviewStatus: "READY",
    draft: { id: "order-1" },
  };
  assert.notDeepEqual(previousReviewLikePayload, createEmptyOrderReview());
  assert.equal(shouldClearReviewForEmptyScope(""), true);
});

test("review layer does not introduce any client-side pricing recomputation helper", () => {
  const reviewState = createEmptyOrderReview();
  const validationState = createEmptyOrderReviewValidation();
  const pricingState = createEmptyOrderPricing();
  assert.equal(reviewState, null);
  assert.equal(validationState, null);
  assert.deepEqual(pricingState, { subtotal: 0, tax: 0, total: 0, currency: "USD" });
});

test("validation refresh remains scoped and conservative under stale scope guard", () => {
  const staleScopeKey = "branch-1::session-1::device-1::order-1";
  const activeScopeKey = "branch-1::session-2::device-2::order-2";
  assert.equal(
    shouldApplyReviewValidationRefreshResult({
      requestedScopeKey: staleScopeKey,
      activeScopeKey,
      requestId: 4,
      latestRequestId: 5,
    }),
    false,
  );
});

test("validation issue display only accepts bounded structured blocker entries", () => {
  assert.deepEqual(getConservativeValidationBlockingIssues(null), []);
  assert.deepEqual(
    getConservativeValidationBlockingIssues({
      reviewValidationStatus: "BLOCKED",
      isReadyForFutureCheckout: false,
      blockingIssues: [
        {
          code: "EMPTY_ORDER",
          severity: "BLOCKER",
          message: "Order must contain at least one active line",
        },
        {
          code: "ITEM_PRICE_MISSING",
          severity: "BLOCKER",
          message: " ",
        },
      ],
      validationSummary: {
        scopedContextStatus: "VALID",
        activeLineCount: 0,
        pricingStatus: "UNRESOLVED",
        blockingIssueCount: 2,
      },
    }),
    [
      {
        code: "EMPTY_ORDER",
        severity: "BLOCKER",
        message: "Order must contain at least one active line",
      },
    ],
  );
});

test("validation issue display keeps multiple bounded blocker entries in deterministic server order", () => {
  assert.deepEqual(
    getConservativeValidationBlockingIssues({
      reviewValidationStatus: "BLOCKED",
      isReadyForFutureCheckout: false,
      blockingIssues: [
        {
          code: "INVALID_SCOPED_CONTEXT",
          severity: "BLOCKER",
          message: "Current scoped order context is invalid",
        },
        {
          code: "ORDER_INVALID_OR_CLOSED",
          severity: "BLOCKER",
          message: "Order is invalid or no longer available for review",
        },
        {
          code: "EMPTY_ORDER",
          severity: "BLOCKER",
          message: "Order must contain at least one active line",
        },
        {
          code: "ITEM_PRICE_MISSING",
          severity: "INFO" as unknown as "BLOCKER",
          message: "One or more active lines cannot be priced",
        },
      ],
      validationSummary: {
        scopedContextStatus: "INVALID",
        activeLineCount: 0,
        pricingStatus: "UNRESOLVED",
        blockingIssueCount: 4,
      },
    }),
    [
      {
        code: "INVALID_SCOPED_CONTEXT",
        severity: "BLOCKER",
        message: "Current scoped order context is invalid",
      },
      {
        code: "ORDER_INVALID_OR_CLOSED",
        severity: "BLOCKER",
        message: "Order is invalid or no longer available for review",
      },
      {
        code: "EMPTY_ORDER",
        severity: "BLOCKER",
        message: "Order must contain at least one active line",
      },
    ],
  );
});

test("validation display helper remains read-only and never infers readiness from blocker length", () => {
  const serverValidationPayload: OrderReviewValidationResult = {
    reviewValidationStatus: "BLOCKED" as const,
    isReadyForFutureCheckout: false,
    blockingIssues: [],
    validationSummary: {
      scopedContextStatus: "VALID" as const,
      activeLineCount: 1,
      pricingStatus: "RESOLVED" as const,
      blockingIssueCount: 0,
    },
  };

  const displayIssues = getConservativeValidationBlockingIssues(serverValidationPayload);

  assert.deepEqual(displayIssues, []);
  assert.equal(serverValidationPayload.isReadyForFutureCheckout, false);
  assert.equal(serverValidationPayload.reviewValidationStatus, "BLOCKED");
});

test("empty scoped order key always clears checkout transition to canonical empty state", () => {
  assert.equal(shouldClearCheckoutTransitionForEmptyScope(""), true);
  assert.equal(shouldClearCheckoutTransitionForEmptyScope("branch-1::session-1::device-1::order-1"), false);
  assert.deepEqual(createEmptyOrderCheckoutTransition(), null);
});

test("stale checkout transition refresh remains scoped and conservative", () => {
  const staleScopeKey = "branch-1::session-1::device-1::order-1";
  const activeScopeKey = "branch-1::session-2::device-2::order-2";
  assert.equal(
    shouldApplyCheckoutTransitionRefreshResult({
      requestedScopeKey: staleScopeKey,
      activeScopeKey,
      requestId: 11,
      latestRequestId: 12,
    }),
    false,
  );
});

test("checkout transition blocker display only accepts structured bounded blocker entries", () => {
  assert.deepEqual(getConservativeCheckoutTransitionBlockingIssues(null), []);
  assert.deepEqual(
    getConservativeCheckoutTransitionBlockingIssues({
      checkoutTransitionStatus: "BLOCKED",
      canEnterFutureCheckout: false,
      blockingIssues: [
        {
          code: "EMPTY_ORDER",
          severity: "BLOCKER",
          message: "Order must contain at least one active line",
        },
        {
          code: "ITEM_PRICE_MISSING",
          severity: "BLOCKER",
          message: " ",
        },
      ],
      transitionSummary: {
        scopedContextStatus: "VALID",
        reviewStatus: "READY",
        reviewValidationStatus: "BLOCKED",
        activeLineCount: 0,
        blockingIssueCount: 2,
      },
    }),
    [
      {
        code: "EMPTY_ORDER",
        severity: "BLOCKER",
        message: "Order must contain at least one active line",
      },
    ],
  );
});

test("checkout transition display helper remains read-only and never infers transition permission locally", () => {
  const serverTransitionPayload: OrderCheckoutTransitionResult = {
    checkoutTransitionStatus: "BLOCKED",
    canEnterFutureCheckout: false,
    blockingIssues: [],
    transitionSummary: {
      scopedContextStatus: "VALID",
      reviewStatus: "READY",
      reviewValidationStatus: "BLOCKED",
      activeLineCount: 2,
      blockingIssueCount: 0,
    },
  };

  const displayIssues = getConservativeCheckoutTransitionBlockingIssues(serverTransitionPayload);

  assert.deepEqual(displayIssues, []);
  assert.equal(serverTransitionPayload.checkoutTransitionStatus, "BLOCKED");
  assert.equal(serverTransitionPayload.canEnterFutureCheckout, false);
});

test("stale checkout entry refresh remains scoped and conservative", () => {
  const staleScopeKey = "branch-1::session-1::device-1::order-1";
  const activeScopeKey = "branch-1::session-2::device-2::order-2";
  assert.equal(
    shouldApplyCheckoutEntryRefreshResult({
      requestedScopeKey: staleScopeKey,
      activeScopeKey,
      requestId: 21,
      latestRequestId: 22,
    }),
    false,
  );
});

test("empty scoped order key always clears checkout entry to canonical empty state", () => {
  assert.equal(shouldClearCheckoutEntryForEmptyScope(""), true);
  assert.equal(shouldClearCheckoutEntryForEmptyScope("branch-1::session-1::device-1::order-1"), false);
  assert.deepEqual(createEmptyOrderCheckoutEntry(), null);
});

test("checkout entry blocker display only accepts structured bounded blocker entries", () => {
  assert.deepEqual(getConservativeCheckoutEntryBlockingIssues(null), []);
  assert.deepEqual(
    getConservativeCheckoutEntryBlockingIssues({
      checkoutEntryStatus: "BLOCKED",
      canEnterCheckoutBoundary: false,
      blockingIssues: [
        {
          code: "EMPTY_ORDER",
          severity: "BLOCKER",
          message: "Order must contain at least one active line",
        },
        {
          code: "ITEM_PRICE_MISSING",
          severity: "BLOCKER",
          message: " ",
        },
      ],
      entrySummary: {
        scopedContextStatus: "VALID",
        reviewValidationStatus: "BLOCKED",
        checkoutTransitionStatus: "BLOCKED",
        activeLineCount: 0,
        blockingIssueCount: 2,
      },
    }),
    [
      {
        code: "EMPTY_ORDER",
        severity: "BLOCKER",
        message: "Order must contain at least one active line",
      },
    ],
  );
});

test("checkout entry display helper remains read-only and never infers execution permission locally", () => {
  const serverEntryPayload: OrderCheckoutEntryResult = {
    checkoutEntryStatus: "BLOCKED",
    canEnterCheckoutBoundary: false,
    blockingIssues: [],
    entrySummary: {
      scopedContextStatus: "VALID",
      reviewValidationStatus: "BLOCKED",
      checkoutTransitionStatus: "BLOCKED",
      activeLineCount: 2,
      blockingIssueCount: 0,
    },
  };

  const displayIssues = getConservativeCheckoutEntryBlockingIssues(serverEntryPayload);

  assert.deepEqual(displayIssues, []);
  assert.equal(serverEntryPayload.checkoutEntryStatus, "BLOCKED");
  assert.equal(serverEntryPayload.canEnterCheckoutBoundary, false);
});

test("add-line success path requires scoped review refresh", () => {
  assert.equal(
    shouldRefreshReviewAfterAddLineSuccess({
      addLineSucceeded: true,
      hasScopedOrder: true,
    }),
    true,
  );
  assert.equal(
    shouldRefreshReviewAfterAddLineSuccess({
      addLineSucceeded: true,
      hasScopedOrder: false,
    }),
    false,
  );
  assert.equal(
    shouldRefreshReviewAfterAddLineSuccess({
      addLineSucceeded: false,
      hasScopedOrder: true,
    }),
    false,
  );
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
