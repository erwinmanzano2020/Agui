"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { OrderReviewValidationResult } from "@/lib/pos/order-review-validation";

import { closePosSessionAction, openPosSessionAction } from "./actions";
import {
  addOrderLineAction,
  createDraftOrderAction,
  getCurrentSessionDraftOrderAction,
  getCurrentSessionOrderLinesAction,
  getCurrentSessionOrderPricingAction,
  getCurrentSessionOrderReviewAction,
  getCurrentSessionOrderReviewValidationAction,
  removeOrderLineAction,
  updateOrderLineAction,
} from "./order-actions";

type PosOrderLineView = {
  id: string;
  itemCode: string;
  quantity: number;
};

type CurrentOrderScope = {
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type LineEditState = Record<string, { itemCode: string; quantity: string }>;
type OrderPricingView = { subtotal: number; tax: number; total: number; currency: string };
type OrderReviewView = {
  reviewStatus: "READY";
  draft: {
    id: string;
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    operatorEntityId: string;
    status: "DRAFT";
  };
  activeLines: Array<{ id: string; orderId: string; itemCode: string; quantity: number }>;
  pricingSummary: { subtotal: number; tax: number; total: number; currency: string };
  pricingTraceLines: Array<{
    lineId: string;
    itemCode: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    pricingSource: "bounded_default" | "override";
    pricingInputSource: "manual" | "default";
  }>;
} | null;
type OrderReviewValidationView = OrderReviewValidationResult | null;

export function resolveInitialBranchId(defaultBranchId: string | null): string {
  return defaultBranchId?.trim() ?? "";
}

export function resolveCurrentOrderScope(input: {
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
}): CurrentOrderScope | null {
  const branchId = input.branchId.trim();
  const sessionId = input.sessionId.trim();
  const deviceId = input.deviceId.trim();
  const orderId = input.orderId.trim();

  if (!branchId || !sessionId || !deviceId || !orderId) {
    return null;
  }

  return { branchId, sessionId, deviceId, orderId };
}

export function parseQuantityInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function serializeCurrentOrderScope(scope: CurrentOrderScope | null): string {
  if (!scope) {
    return "";
  }

  return `${scope.branchId}::${scope.sessionId}::${scope.deviceId}::${scope.orderId}`;
}

export function shouldApplyLineRefreshResult(input: {
  requestedScopeKey: string;
  activeScopeKey: string;
  requestId: number;
  latestRequestId: number;
}): boolean {
  if (!input.requestedScopeKey) {
    return false;
  }

  return input.requestId === input.latestRequestId && input.requestedScopeKey === input.activeScopeKey;
}

export function shouldApplyPricingRefreshResult(input: {
  requestedScopeKey: string;
  activeScopeKey: string;
  requestId: number;
  latestRequestId: number;
}): boolean {
  return shouldApplyLineRefreshResult(input);
}

export function shouldApplyReviewRefreshResult(input: {
  requestedScopeKey: string;
  activeScopeKey: string;
  requestId: number;
  latestRequestId: number;
}): boolean {
  return shouldApplyLineRefreshResult(input);
}
export function shouldApplyReviewValidationRefreshResult(input: {
  requestedScopeKey: string;
  activeScopeKey: string;
  requestId: number;
  latestRequestId: number;
}): boolean {
  return shouldApplyLineRefreshResult(input);
}

export function shouldRefreshPricingAfterLineRefresh(input: {
  cancelled: boolean;
  requestedScopeKey: string;
  activeScopeKey: string;
}): boolean {
  if (input.cancelled) {
    return false;
  }

  return input.requestedScopeKey !== "" && input.requestedScopeKey === input.activeScopeKey;
}

export function clearLineSurfaceState(): { lines: PosOrderLineView[]; lineEdits: LineEditState } {
  return { lines: [], lineEdits: {} };
}

export function createEmptyOrderPricing(): OrderPricingView {
  return { subtotal: 0, tax: 0, total: 0, currency: "USD" };
}

export function createEmptyOrderReview(): OrderReviewView {
  return null;
}
export function createEmptyOrderReviewValidation(): OrderReviewValidationView {
  return null;
}
export function getConservativeValidationBlockingIssues(
  reviewValidation: OrderReviewValidationView,
): NonNullable<OrderReviewValidationView>["blockingIssues"] {
  if (!reviewValidation) {
    return [];
  }

  return reviewValidation.blockingIssues.filter(
    (issue): issue is NonNullable<OrderReviewValidationView>["blockingIssues"][number] =>
      (issue.code === "EMPTY_ORDER" ||
        issue.code === "ORDER_INVALID_OR_CLOSED" ||
        issue.code === "ITEM_PRICE_MISSING" ||
        issue.code === "INVALID_SCOPED_CONTEXT") &&
      issue.severity === "BLOCKER" &&
      typeof issue.message === "string" &&
      issue.message.trim() !== "",
  );
}

export function shouldRefreshReviewAfterAddLineSuccess(input: { addLineSucceeded: boolean; hasScopedOrder: boolean }): boolean {
  return input.addLineSucceeded && input.hasScopedOrder;
}

export function shouldClearReviewForEmptyScope(currentScopeKey: string): boolean {
  return currentScopeKey === "";
}
export function shouldClearValidationForEmptyScope(currentScopeKey: string): boolean {
  return currentScopeKey === "";
}

export function PosSessionClient({ slug, defaultBranchId }: { slug: string; defaultBranchId: string | null }) {
  const [deviceCode, setDeviceCode] = useState("");
  const [qrIdentifier, setQrIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [branchId, setBranchId] = useState(resolveInitialBranchId(defaultBranchId));

  const [openSessionId, setOpenSessionId] = useState("");
  const [openDeviceId, setOpenDeviceId] = useState("");
  const [closeReason, setCloseReason] = useState("");

  const [activeOrderId, setActiveOrderId] = useState("");
  const [lines, setLines] = useState<PosOrderLineView[]>([]);
  const [newItemCode, setNewItemCode] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [lineEdits, setLineEdits] = useState<LineEditState>({});
  const [pricing, setPricing] = useState<OrderPricingView>(createEmptyOrderPricing());
  const [review, setReview] = useState<OrderReviewView>(createEmptyOrderReview());
  const [reviewValidation, setReviewValidation] = useState<OrderReviewValidationView>(createEmptyOrderReviewValidation());

  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeScopeKeyRef = useRef("");
  const latestLinesRequestIdRef = useRef(0);
  const latestPricingRequestIdRef = useRef(0);
  const latestReviewRequestIdRef = useRef(0);
  const latestReviewValidationRequestIdRef = useRef(0);

  const currentScope = useMemo(
    () =>
      resolveCurrentOrderScope({
        branchId,
        sessionId: openSessionId,
        deviceId: openDeviceId,
        orderId: activeOrderId,
      }),
    [activeOrderId, branchId, openDeviceId, openSessionId],
  );
  const currentScopeKey = useMemo(() => serializeCurrentOrderScope(currentScope), [currentScope]);
  const displayBlockingIssues = useMemo(
    () => getConservativeValidationBlockingIssues(reviewValidation),
    [reviewValidation],
  );

  useEffect(() => {
    activeScopeKeyRef.current = currentScopeKey;
    if (!currentScopeKey) {
      latestLinesRequestIdRef.current += 1;
      latestPricingRequestIdRef.current += 1;
      latestReviewRequestIdRef.current += 1;
      latestReviewValidationRequestIdRef.current += 1;
      if (shouldClearReviewForEmptyScope(currentScopeKey)) {
        setReview(createEmptyOrderReview());
      }
      if (shouldClearValidationForEmptyScope(currentScopeKey)) {
        setReviewValidation(createEmptyOrderReviewValidation());
      }
    }
  }, [currentScopeKey]);

  function clearOrderSurface() {
    latestLinesRequestIdRef.current += 1;
    activeScopeKeyRef.current = "";
    const cleared = clearLineSurfaceState();
    setActiveOrderId("");
    setLines(cleared.lines);
    setLineEdits(cleared.lineEdits);
    setPricing(createEmptyOrderPricing());
    setReview(createEmptyOrderReview());
    setReviewValidation(createEmptyOrderReviewValidation());
    setNewItemCode("");
    setNewQuantity("1");
  }

  const refreshLines = useCallback(async (scope: CurrentOrderScope) => {
    const requestId = latestLinesRequestIdRef.current + 1;
    latestLinesRequestIdRef.current = requestId;
    const requestedScopeKey = serializeCurrentOrderScope(scope);

    const response = await getCurrentSessionOrderLinesAction(slug, {
      branchId: scope.branchId,
      sessionId: scope.sessionId,
      deviceId: scope.deviceId,
      orderId: scope.orderId,
    });

    if (
      !shouldApplyLineRefreshResult({
        requestedScopeKey,
        activeScopeKey: activeScopeKeyRef.current,
        requestId,
        latestRequestId: latestLinesRequestIdRef.current,
      })
    ) {
      return;
    }

    if (!response.ok) {
      setMessage(response.error);
      const cleared = clearLineSurfaceState();
      setLines(cleared.lines);
      setLineEdits(cleared.lineEdits);
      return;
    }

    setLines(response.lines);
    setLineEdits((current) => {
      const next: Record<string, { itemCode: string; quantity: string }> = {};
      for (const line of response.lines) {
        const previous = current[line.id];
        next[line.id] = {
          itemCode: previous?.itemCode ?? line.itemCode,
          quantity: previous?.quantity ?? String(line.quantity),
        };
      }
      return next;
    });
  }, [slug]);

  const refreshPricing = useCallback(async (scope: CurrentOrderScope) => {
    const requestId = latestPricingRequestIdRef.current + 1;
    latestPricingRequestIdRef.current = requestId;
    const requestedScopeKey = serializeCurrentOrderScope(scope);

    const response = await getCurrentSessionOrderPricingAction(slug, {
      branchId: scope.branchId,
      sessionId: scope.sessionId,
      deviceId: scope.deviceId,
      orderId: scope.orderId,
    });

    if (
      !shouldApplyPricingRefreshResult({
        requestedScopeKey,
        activeScopeKey: activeScopeKeyRef.current,
        requestId,
        latestRequestId: latestPricingRequestIdRef.current,
      })
    ) {
      return;
    }

    if (!response.ok) {
      setMessage(response.error);
      setPricing(createEmptyOrderPricing());
      return;
    }

    setPricing(response.pricing);
  }, [slug]);

  const refreshReview = useCallback(async (scope: CurrentOrderScope) => {
    const requestId = latestReviewRequestIdRef.current + 1;
    latestReviewRequestIdRef.current = requestId;
    const requestedScopeKey = serializeCurrentOrderScope(scope);

    const response = await getCurrentSessionOrderReviewAction(slug, {
      branchId: scope.branchId,
      sessionId: scope.sessionId,
      deviceId: scope.deviceId,
      orderId: scope.orderId,
    });

    if (
      !shouldApplyReviewRefreshResult({
        requestedScopeKey,
        activeScopeKey: activeScopeKeyRef.current,
        requestId,
        latestRequestId: latestReviewRequestIdRef.current,
      })
    ) {
      return;
    }

    if (!response.ok) {
      setMessage(response.error);
      setReview(createEmptyOrderReview());
      return;
    }

    setReview(response.review);
  }, [slug]);

  const refreshReviewValidation = useCallback(async (scope: CurrentOrderScope) => {
    const requestId = latestReviewValidationRequestIdRef.current + 1;
    latestReviewValidationRequestIdRef.current = requestId;
    const requestedScopeKey = serializeCurrentOrderScope(scope);

    const response = await getCurrentSessionOrderReviewValidationAction(slug, {
      branchId: scope.branchId,
      sessionId: scope.sessionId,
      deviceId: scope.deviceId,
      orderId: scope.orderId,
    });

    if (
      !shouldApplyReviewValidationRefreshResult({
        requestedScopeKey,
        activeScopeKey: activeScopeKeyRef.current,
        requestId,
        latestRequestId: latestReviewValidationRequestIdRef.current,
      })
    ) {
      return;
    }

    if (!response.ok) {
      setMessage(response.error);
      setReviewValidation(createEmptyOrderReviewValidation());
      return;
    }

    setReviewValidation(response.reviewValidation);
  }, [slug]);

  useEffect(() => {
    if (!currentScope) {
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      const requestedScopeKey = serializeCurrentOrderScope(currentScope);
      const draftResult = await getCurrentSessionDraftOrderAction(slug, {
        branchId: currentScope.branchId,
        sessionId: currentScope.sessionId,
        deviceId: currentScope.deviceId,
        orderId: currentScope.orderId,
      });

      if (cancelled) {
        return;
      }

      if (!draftResult.ok) {
        setMessage(draftResult.error);
        setLines([]);
        setLineEdits({});
        setPricing(createEmptyOrderPricing());
        setReview(createEmptyOrderReview());
        setReviewValidation(createEmptyOrderReviewValidation());
        return;
      }

      await refreshLines(currentScope);
      if (
        !shouldRefreshPricingAfterLineRefresh({
          cancelled,
          requestedScopeKey,
          activeScopeKey: activeScopeKeyRef.current,
        })
      ) {
        return;
      }

      await refreshPricing(currentScope);
      await refreshReview(currentScope);
      await refreshReviewValidation(currentScope);
    });

    return () => {
      cancelled = true;
    };
  }, [currentScope, refreshLines, refreshPricing, refreshReview, refreshReviewValidation, slug]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">POS Session Sign-in</h1>
      <p className="text-sm text-muted-foreground">QR identifier + POS PIN are both required to open a POS device session.</p>

      <div className="space-y-2 rounded border p-4">
        <h2 className="font-medium">Open Session</h2>
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Branch ID (required)" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Device code" value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} />
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Employee QR identifier" value={qrIdentifier} onChange={(e) => setQrIdentifier(e.target.value)} />
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="POS PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
        <button
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await openPosSessionAction(slug, { branchId, deviceCode, qrIdentifier, pin });
              if (result.ok) {
                setMessage(`Session opened: ${result.sessionId}`);
                setOpenSessionId(result.sessionId);
                setOpenDeviceId(result.deviceId);
                setPin("");
                clearOrderSurface();
              } else {
                setMessage(result.error);
              }
            });
          }}
        >
          {isPending ? "Opening…" : "Open POS Session"}
        </button>
      </div>

      <div className="space-y-2 rounded border p-4">
        <h2 className="font-medium">Close Session</h2>
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Session ID" value={openSessionId} onChange={(e) => setOpenSessionId(e.target.value)} />
        <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Close reason (optional)" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
        <button
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await closePosSessionAction(slug, { branchId, sessionId: openSessionId, reason: closeReason || null });
              if (result.ok) {
                setMessage(`Session closed: ${result.sessionId}`);
                setOpenSessionId("");
                setOpenDeviceId("");
                clearOrderSurface();
              } else {
                setMessage(result.error);
              }
            });
          }}
        >
          {isPending ? "Closing…" : "Close POS Session"}
        </button>
      </div>

      <div className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Current Session Draft Order</h2>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Draft order ID"
          value={activeOrderId}
          onChange={(e) => setActiveOrderId(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            disabled={isPending || !openSessionId.trim() || !openDeviceId.trim() || !branchId.trim()}
            onClick={() => {
              startTransition(async () => {
                const result = await createDraftOrderAction(slug, {
                  branchId,
                  sessionId: openSessionId,
                  deviceId: openDeviceId,
                });

                if (!result.ok) {
                  setMessage(result.error);
                  return;
                }

                setActiveOrderId(result.orderId);
                setMessage(`Draft order ready: ${result.orderId}`);
              });
            }}
          >
            {isPending ? "Creating…" : "Create Draft"}
          </button>
          <button
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            disabled={isPending || !currentScope}
            onClick={() => {
              if (!currentScope) {
                return;
              }

              startTransition(async () => {
                await refreshLines(currentScope);
                await refreshPricing(currentScope);
                await refreshReview(currentScope);
                await refreshReviewValidation(currentScope);
              });
            }}
          >
            {isPending ? "Refreshing…" : "Refresh Lines"}
          </button>
        </div>

        <div className="space-y-2 rounded border p-3">
          <h3 className="text-sm font-medium">Add line</h3>
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Item code" value={newItemCode} onChange={(e) => setNewItemCode(e.target.value)} />
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Quantity" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} />
          <button
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            disabled={isPending || !currentScope}
            onClick={() => {
              if (!currentScope) {
                return;
              }

              const quantity = parseQuantityInput(newQuantity);
              if (quantity === null) {
                return;
              }

              startTransition(async () => {
                const result = await addOrderLineAction(slug, {
                  branchId: currentScope.branchId,
                  sessionId: currentScope.sessionId,
                  deviceId: currentScope.deviceId,
                  orderId: currentScope.orderId,
                  itemCode: newItemCode,
                  quantity,
                });

                if (!result.ok) {
                  setMessage(result.error);
                  return;
                }

                setMessage(`Line added: ${result.lineId}`);
                setNewItemCode("");
                setNewQuantity("1");
                await refreshLines(currentScope);
                await refreshPricing(currentScope);
                if (
                  shouldRefreshReviewAfterAddLineSuccess({
                    addLineSucceeded: result.ok,
                    hasScopedOrder: currentScope !== null,
                  })
                ) {
                  await refreshReview(currentScope);
                }
                await refreshReviewValidation(currentScope);
              });
            }}
          >
            Add line
          </button>
        </div>

        <ul className="space-y-2">
          {lines.map((line) => {
            const edit = lineEdits[line.id] ?? { itemCode: line.itemCode, quantity: String(line.quantity) };

            return (
              <li key={line.id} className="space-y-2 rounded border p-3 text-sm">
                <p>Line: {line.id}</p>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={edit.itemCode}
                  onChange={(e) =>
                    setLineEdits((current) => ({
                      ...current,
                      [line.id]: { ...edit, itemCode: e.target.value },
                    }))
                  }
                />
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={edit.quantity}
                  onChange={(e) =>
                    setLineEdits((current) => ({
                      ...current,
                      [line.id]: { ...edit, quantity: e.target.value },
                    }))
                  }
                />
                <div className="flex gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={isPending || !currentScope}
                    onClick={() => {
                      if (!currentScope) {
                        return;
                      }

                      const quantity = parseQuantityInput(edit.quantity);
                      if (quantity === null) {
                        return;
                      }

                      startTransition(async () => {
                        const result = await updateOrderLineAction(slug, {
                          branchId: currentScope.branchId,
                          sessionId: currentScope.sessionId,
                          deviceId: currentScope.deviceId,
                          orderId: currentScope.orderId,
                          lineId: line.id,
                          itemCode: edit.itemCode,
                          quantity,
                        });

                        if (!result.ok) {
                          setMessage(result.error);
                          return;
                        }

                        setMessage(`Line updated: ${result.lineId}`);
                        await refreshLines(currentScope);
                        await refreshPricing(currentScope);
                        await refreshReview(currentScope);
                        await refreshReviewValidation(currentScope);
                      });
                    }}
                  >
                    Update
                  </button>
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={isPending || !currentScope}
                    onClick={() => {
                      if (!currentScope) {
                        return;
                      }

                      startTransition(async () => {
                        const result = await removeOrderLineAction(slug, {
                          branchId: currentScope.branchId,
                          sessionId: currentScope.sessionId,
                          deviceId: currentScope.deviceId,
                          orderId: currentScope.orderId,
                          lineId: line.id,
                        });

                        if (!result.ok) {
                          setMessage(result.error);
                          return;
                        }

                        setMessage(`Line removed: ${result.lineId}`);
                        await refreshLines(currentScope);
                        await refreshPricing(currentScope);
                        await refreshReview(currentScope);
                        await refreshReviewValidation(currentScope);
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1 rounded border p-3 text-sm">
          <h3 className="font-medium">Order Summary</h3>
          <p>Subtotal: {pricing.currency} {pricing.subtotal.toFixed(2)}</p>
          <p>Tax: {pricing.currency} {pricing.tax.toFixed(2)}</p>
          <p>Total: {pricing.currency} {pricing.total.toFixed(2)}</p>
        </div>

        <div className="space-y-2 rounded border p-3 text-sm">
          <h3 className="font-medium">Pre-Checkout Review (Read-Only)</h3>
          {review ? (
            <>
              <p>Review status: {review.reviewStatus}</p>
              <p>Order ID: {review.draft.id}</p>
              <p>Active lines: {review.activeLines.length}</p>
              <ul className="space-y-1">
                {review.activeLines.map((line) => (
                  <li key={`review-line-${line.id}`}>
                    {line.itemCode} × {line.quantity} (line {line.id})
                  </li>
                ))}
              </ul>
              <p>Subtotal: {review.pricingSummary.currency} {review.pricingSummary.subtotal.toFixed(2)}</p>
              <p>Tax: {review.pricingSummary.currency} {review.pricingSummary.tax.toFixed(2)}</p>
              <p>Total: {review.pricingSummary.currency} {review.pricingSummary.total.toFixed(2)}</p>
              <ul className="space-y-1">
                {review.pricingTraceLines.map((traceLine) => (
                  <li key={`review-trace-${traceLine.lineId}`}>
                    {traceLine.lineId}: {traceLine.quantity} × {traceLine.unitPrice.toFixed(2)} = {traceLine.lineTotal.toFixed(2)} (
                    {traceLine.pricingSource}, {traceLine.pricingInputSource})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Review unavailable for the current scope.</p>
          )}
        </div>

        <div className="space-y-2 rounded border p-3 text-sm">
          <h3 className="font-medium">Review Validation / Checkout Readiness (Read-Only)</h3>
          {reviewValidation ? (
            <>
              <p>Validation status: {reviewValidation.reviewValidationStatus}</p>
              <p>Ready for a future checkout slice: {reviewValidation.isReadyForFutureCheckout ? "Yes" : "No"}</p>
              <p>Scoped context: {reviewValidation.validationSummary.scopedContextStatus}</p>
              <p>Active lines counted: {reviewValidation.validationSummary.activeLineCount}</p>
              <p>Pricing resolvable: {reviewValidation.validationSummary.pricingStatus}</p>
              {displayBlockingIssues.length > 0 ? (
                <ul className="space-y-1">
                  {displayBlockingIssues.map((issue, index) => (
                    <li key={`validation-issue-${issue.code}-${index}`}>
                      {issue.code} [{issue.severity}] — {issue.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No blocking issues.</p>
              )}
            </>
          ) : (
            <p>Validation unavailable for the current scope.</p>
          )}
        </div>
      </div>

      {message ? <p className="rounded bg-muted p-3 text-sm">{message}</p> : null}
    </div>
  );
}
