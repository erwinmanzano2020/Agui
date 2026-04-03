"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { closePosSessionAction, openPosSessionAction } from "./actions";
import {
  addOrderLineAction,
  createDraftOrderAction,
  getCurrentSessionDraftOrderAction,
  getCurrentSessionOrderLinesAction,
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
  const [lineEdits, setLineEdits] = useState<Record<string, { itemCode: string; quantity: string }>>({});

  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function clearOrderSurface() {
    setActiveOrderId("");
    setLines([]);
    setLineEdits({});
    setNewItemCode("");
    setNewQuantity("1");
  }

  const refreshLines = useCallback(async (scope: CurrentOrderScope) => {
    const response = await getCurrentSessionOrderLinesAction(slug, {
      branchId: scope.branchId,
      sessionId: scope.sessionId,
      deviceId: scope.deviceId,
      orderId: scope.orderId,
    });

    if (!response.ok) {
      setMessage(response.error);
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

  useEffect(() => {
    if (!currentScope) {
      return;
    }

    let cancelled = false;

    startTransition(async () => {
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
        return;
      }

      await refreshLines(currentScope);
    });

    return () => {
      cancelled = true;
    };
  }, [currentScope, refreshLines, slug]);

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
      </div>

      {message ? <p className="rounded bg-muted p-3 text-sm">{message}</p> : null}
    </div>
  );
}
