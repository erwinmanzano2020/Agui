"use client";

import { useState, useTransition } from "react";

import { closePosSessionAction, openPosSessionAction } from "./actions";

export function resolveInitialBranchId(defaultBranchId: string | null): string {
  return defaultBranchId?.trim() ?? "";
}

export function PosSessionClient({ slug, defaultBranchId }: { slug: string; defaultBranchId: string | null }) {
  const [deviceCode, setDeviceCode] = useState("");
  const [qrIdentifier, setQrIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [branchId, setBranchId] = useState(resolveInitialBranchId(defaultBranchId));
  const [openSessionId, setOpenSessionId] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
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
                setPin("");
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
              setMessage(result.ok ? `Session closed: ${result.sessionId}` : result.error);
            });
          }}
        >
          {isPending ? "Closing…" : "Close POS Session"}
        </button>
      </div>

      {message ? <p className="rounded bg-muted p-3 text-sm">{message}</p> : null}
    </div>
  );
}
