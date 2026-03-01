"use client";

import * as React from "react";

type ScanResponse = {
  action: "clock_in" | "clock_out" | "debounced";
  employee: { id: string; code: string | null; displayName: string };
  time: string;
  offlineAccepted: boolean;
};

type QueuedEvent = {
  clientEventId: string;
  qrToken: string;
  occurredAt: string;
};

type PingResponse = {
  ok: true;
  device: {
    id: string;
    name: string;
    branch_id: string;
    branch_name?: string | null;
    disabled_at?: string | null;
  };
  house_id: string;
};

type SetupStep = "welcome" | "token" | "verify" | "confirm" | "harden";

const TOKEN_STORAGE_KEY = "hr-kiosk-token";
const PIN_STORAGE_KEY = "hr-kiosk-pin";
const QUEUE_STORAGE_KEY = "hr-kiosk-queue";
const DISPLAY_NAME_STORAGE_KEY = "hr-kiosk-display-name";
const VERIFIED_DEVICE_ID_STORAGE_KEY = "hr-kiosk-verified-device-id";
const LAST_SYNC_STORAGE_KEY = "hr-kiosk-last-sync-at";

function generateClientEventId(): string {
  return crypto.randomUUID();
}

export default function KioskClient({ slug }: { slug: string }) {
  const [kioskToken, setKioskToken] = React.useState("");
  const [draftToken, setDraftToken] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [draftPin, setDraftPin] = React.useState("");
  const [status, setStatus] = React.useState<"online" | "offline">(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
  );
  const [queue, setQueue] = React.useState<QueuedEvent[]>([]);
  const [lastResult, setLastResult] = React.useState<ScanResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [manualQr, setManualQr] = React.useState("");
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [setupStep, setSetupStep] = React.useState<SetupStep>("welcome");
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [verifiedDevice, setVerifiedDevice] = React.useState<PingResponse["device"] | null>(null);
  const [allowOfflineSetup, setAllowOfflineSetup] = React.useState(false);
  const [draftDisplayName, setDraftDisplayName] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [verifiedDeviceId, setVerifiedDeviceId] = React.useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const pressTimerRef = React.useRef<number | null>(null);

  const needsSetup = !kioskToken || !verifiedDeviceId;

  React.useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    const savedPin = localStorage.getItem(PIN_STORAGE_KEY) ?? "";
    const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    const savedDisplayName = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? "";
    const savedVerifiedDeviceId = localStorage.getItem(VERIFIED_DEVICE_ID_STORAGE_KEY);
    const savedLastSyncAt = localStorage.getItem(LAST_SYNC_STORAGE_KEY);

    setKioskToken(savedToken);
    setDraftToken(savedToken);
    setPin(savedPin);
    setDraftPin(savedPin);
    setDisplayName(savedDisplayName);
    setDraftDisplayName(savedDisplayName);
    setVerifiedDeviceId(savedVerifiedDeviceId);
    setLastSyncAt(savedLastSyncAt);
    if (savedQueue) {
      try {
        setQueue(JSON.parse(savedQueue) as QueuedEvent[]);
      } catch {
        setQueue([]);
      }
    }

    setSetupOpen(!savedToken || !savedVerifiedDeviceId);

    const onOnline = () => setStatus("online");
    const onOffline = () => setStatus("offline");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  React.useEffect(() => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  const queueEvent = React.useCallback((qrToken: string) => {
    const event: QueuedEvent = {
      clientEventId: generateClientEventId(),
      qrToken,
      occurredAt: new Date().toISOString(),
    };
    setQueue((prev) => [...prev, event]);
  }, []);

  const sendScan = React.useCallback(
    async (qrToken: string) => {
      if (!kioskToken) {
        setError("Complete kiosk setup first.");
        return;
      }

      try {
      const response = await fetch("/api/hr/kiosk/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${kioskToken}`,
        },
          body: JSON.stringify({ qrToken, occurredAt: new Date().toISOString() }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Scan failed");
        }

        const payload = (await response.json()) as ScanResponse;
        setLastResult(payload);
        setError(null);
      } catch (scanError) {
        queueEvent(qrToken);
        setLastResult(null);
        setError(`Offline/failed. Queued for sync. (${scanError instanceof Error ? scanError.message : "error"})`);
      }
    },
    [kioskToken, queueEvent],
  );

  const syncQueue = React.useCallback(async () => {
    if (queue.length === 0 || status !== "online" || !kioskToken) return;

    try {
      const response = await fetch("/api/hr/kiosk/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${kioskToken}`,
        },
        body: JSON.stringify({ events: queue }),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as {
        results: Array<{
          clientEventId: string;
          status: "duplicate" | "processed" | "error";
          result?: ScanResponse;
        }>;
      };

      const completed = new Set(payload.results.filter((item) => item.status !== "error").map((item) => item.clientEventId));
      const latestProcessed = payload.results.find((item) => item.status === "processed" && item.result?.employee);
      if (latestProcessed?.result) {
        setLastResult(latestProcessed.result);
      }

      setQueue((prev) => prev.filter((event) => !completed.has(event.clientEventId)));
      const now = new Date().toISOString();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_STORAGE_KEY, now);
    } catch {
      // keep queue for next attempt
    }
  }, [kioskToken, queue, status]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void syncQueue();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [syncQueue]);

  async function verifyToken(tokenToVerify: string): Promise<boolean> {
    setVerifyError(null);
    try {
      const response = await fetch("/api/hr/kiosk/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tokenToVerify}`,
        },
        body: JSON.stringify({ slug }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
      } & Partial<PingResponse>;

      if (!response.ok) {
        if (response.status === 403 && payload.reason === "device_disabled") {
          setVerifyError("Device disabled — contact HR.");
        } else if (response.status === 401) {
          setVerifyError("Invalid kiosk token. Check and retry.");
        } else {
          setVerifyError(payload.error ?? "Server unreachable. You can continue offline setup.");
        }
        return false;
      }

      if (!payload.device || !payload.house_id) {
        setVerifyError("Unexpected server response.");
        return false;
      }

      const device = payload.device as PingResponse["device"];
      setVerifiedDevice(device);
      setDraftDisplayName(device.name || draftDisplayName);
      setAllowOfflineSetup(false);
      return true;
    } catch {
      setVerifyError("Server unreachable. You can continue offline setup.");
      return false;
    }
  }

  async function startCameraScan() {
    if (!("BarcodeDetector" in window)) {
      setError("BarcodeDetector API is unavailable on this device/browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const DetectorCtor = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
      if (!DetectorCtor) {
        stream.getTracks().forEach((track) => track.stop());
        setError("BarcodeDetector API is unavailable on this device/browser.");
        return;
      }
      const detector = new DetectorCtor({ formats: ["qr_code"] });

      const run = async () => {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) {
            stream.getTracks().forEach((track) => track.stop());
            await sendScan(codes[0].rawValue);
            return;
          }
        } catch {
          // retry loop
        }
        window.requestAnimationFrame(() => {
          void run();
        });
      };

      void run();
    } catch {
      setError("Unable to access camera.");
    }
  }

  function openSettingsWithGuard() {
    if (pin) {
      const entered = window.prompt("Enter kiosk PIN", "");
      if (!entered || entered !== pin) {
        setSettingsError("Invalid PIN.");
        return;
      }
    }
    setSettingsOpen(true);
    setSettingsError(null);
  }

  function startLongPress() {
    if (pin) return;
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
    }
    pressTimerRef.current = window.setTimeout(() => {
      setSettingsOpen(true);
      setSettingsError(null);
    }, 3000);
  }

  function stopLongPress() {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function saveSettings() {
    localStorage.setItem(TOKEN_STORAGE_KEY, draftToken);
    localStorage.setItem(PIN_STORAGE_KEY, draftPin);
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, draftDisplayName);
    setKioskToken(draftToken);
    setPin(draftPin);
    setDisplayName(draftDisplayName);
    setSettingsError(null);
    if (draftToken !== kioskToken) {
      localStorage.removeItem(VERIFIED_DEVICE_ID_STORAGE_KEY);
      setVerifiedDeviceId(null);
      setSetupOpen(true);
      setSetupStep("verify");
      setVerifyError("Token changed. Re-verify connection.");
    }
  }

  function clearQueue() {
    const confirmed = window.confirm("Clear local queued events?");
    if (!confirmed) return;
    setQueue([]);
    setSettingsError(null);
  }

  function resetKiosk() {
    const confirmed = window.confirm("Reset kiosk? This clears token, PIN, queue, and setup state.");
    if (!confirmed) return;

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(PIN_STORAGE_KEY);
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
    localStorage.removeItem(VERIFIED_DEVICE_ID_STORAGE_KEY);
    localStorage.removeItem(LAST_SYNC_STORAGE_KEY);

    setKioskToken("");
    setDraftToken("");
    setPin("");
    setDraftPin("");
    setQueue([]);
    setDisplayName("");
    setDraftDisplayName("");
    setVerifiedDevice(null);
    setVerifiedDeviceId(null);
    setLastSyncAt(null);
    setSettingsOpen(false);
    setSetupOpen(true);
    setSetupStep("welcome");
  }

  function finishSetup() {
    if (!allowOfflineSetup && !verifiedDevice?.id) {
      setVerifyError("Verify token first or choose Continue offline.");
      setSetupStep("verify");
      return;
    }

    const tokenToSave = draftToken.trim();
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenToSave);
    localStorage.setItem(PIN_STORAGE_KEY, draftPin);
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, draftDisplayName);

    if (verifiedDevice?.id) {
      localStorage.setItem(VERIFIED_DEVICE_ID_STORAGE_KEY, verifiedDevice.id);
      setVerifiedDeviceId(verifiedDevice.id);
    }

    setKioskToken(tokenToSave);
    setPin(draftPin);
    setDisplayName(draftDisplayName);
    setSetupStep("harden");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">HR Kiosk</h1>

      <div className="rounded border p-3 text-sm">
        Status: <strong>{status === "online" ? "Online" : "Offline"}</strong> (Queued: {queue.length})
      </div>

      {(setupOpen || needsSetup) && (
        <section className="space-y-3 rounded border bg-white p-4 text-sm">
          <h2 className="text-lg font-semibold">Kiosk Setup Wizard</h2>

          {setupStep === "welcome" && (
            <div className="space-y-2">
              <p>Workspace: <strong>{slug}</strong></p>
              <p>Branch context: <strong>{verifiedDevice?.branch_name ?? "Not yet verified"}</strong></p>
              <p>This kiosk records clock-ins/outs and needs internet occasionally for sync.</p>
              <button className="rounded border px-3 py-2" onClick={() => setSetupStep("token")}>Start setup</button>
            </div>
          )}

          {setupStep === "token" && (
            <div className="space-y-2">
              <label className="block font-medium">Enter kiosk token</label>
              <input
                className="w-full rounded border p-2"
                value={draftToken}
                onChange={(event) => setDraftToken(event.target.value)}
                placeholder="Paste x-kiosk-token"
              />
              <div className="flex gap-2">
                <button className="rounded border px-3 py-2" onClick={() => setSetupStep("welcome")}>Back</button>
                <button className="rounded border px-3 py-2" disabled={!draftToken.trim()} onClick={() => setSetupStep("verify")}>Continue</button>
              </div>
            </div>
          )}

          {setupStep === "verify" && (
            <div className="space-y-2">
              <p>Verify connection and token before finishing setup.</p>
              <button className="rounded border px-3 py-2" onClick={async () => {
                const ok = await verifyToken(draftToken.trim());
                if (ok) setSetupStep("confirm");
              }} disabled={!draftToken.trim()}>
                Verify connection
              </button>
              {verifiedDevice ? (
                <div className="rounded border border-green-500 bg-green-50 p-2">
                  ✅ Connected — {verifiedDevice.name} ({verifiedDevice.branch_name ?? verifiedDevice.branch_id})
                </div>
              ) : null}
              {verifyError ? <div className="rounded border border-red-500 bg-red-50 p-2">❌ {verifyError}</div> : null}
              <div className="flex gap-2">
                <button className="rounded border px-3 py-2" onClick={() => setSetupStep("token")}>Back</button>
                <button className="rounded border px-3 py-2" onClick={() => { setAllowOfflineSetup(true); setSetupStep("confirm"); }}>
                  Continue offline
                </button>
              </div>
            </div>
          )}

          {setupStep === "confirm" && (
            <div className="space-y-2">
              <label className="block font-medium">Device name</label>
              <input
                className="w-full rounded border p-2"
                value={draftDisplayName}
                onChange={(event) => setDraftDisplayName(event.target.value)}
                placeholder="Front Door Kiosk"
              />
              <label className="block font-medium">Optional settings PIN</label>
              <input
                className="w-full rounded border p-2"
                value={draftPin}
                onChange={(event) => setDraftPin(event.target.value)}
                placeholder="Set PIN (device-local)"
                type="password"
              />
              <p className="text-xs text-muted-foreground">PIN is stored only on this device (localStorage).</p>
              <div className="flex gap-2">
                <button className="rounded border px-3 py-2" onClick={() => setSetupStep("verify")}>Back</button>
                <button className="rounded border px-3 py-2" onClick={finishSetup}>Finish setup</button>
              </div>
            </div>
          )}

          {setupStep === "harden" && (
            <div className="space-y-2">
              <h3 className="font-medium">Lockscreen / Hardening Tips</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Keep screen on.</li>
                <li>Auto-start browser on boot.</li>
                <li>Add kiosk URL to home screen.</li>
                <li>Pin the app (Android screen pinning).</li>
                <li>Keep charger connected.</li>
              </ul>
              <button className="rounded border px-3 py-2" onClick={() => setSetupOpen(false)}>Done</button>
            </div>
          )}
        </section>
      )}

      {!needsSetup && !setupOpen && (
        <>
          <section className="space-y-2 rounded border p-3">
            <h2 className="font-medium">Scan QR</h2>
            <button className="w-full rounded bg-black px-3 py-3 text-white" onClick={() => void startCameraScan()}>
              Open Camera Scanner
            </button>
            <input
              className="w-full rounded border p-2"
              placeholder="Manual QR token fallback"
              value={manualQr}
              onChange={(event) => setManualQr(event.target.value)}
            />
            <button className="w-full rounded border px-3 py-2" onClick={() => void sendScan(manualQr)}>
              Submit QR token
            </button>
          </section>

          <button
            className="self-end rounded px-2 py-1 text-xs text-muted-foreground underline"
            onClick={openSettingsWithGuard}
            onMouseDown={startLongPress}
            onMouseUp={stopLongPress}
            onMouseLeave={stopLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={stopLongPress}
          >
            Settings
          </button>

          {settingsError ? <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-700">{settingsError}</div> : null}
        </>
      )}

      {settingsOpen && (
        <section className="space-y-2 rounded border p-3 text-sm">
          <h2 className="font-medium">Kiosk Settings</h2>
          <p>Device: {displayName || verifiedDevice?.name || "Unnamed"}</p>
          <p>Last sync: {lastSyncAt ?? "Never"}</p>
          <p>Queue length: {queue.length}</p>
          <p>Connectivity: {status}</p>

          <input
            className="w-full rounded border p-2"
            placeholder="Kiosk token"
            value={draftToken}
            onChange={(event) => setDraftToken(event.target.value)}
          />
          <input
            className="w-full rounded border p-2"
            placeholder="Display name"
            value={draftDisplayName}
            onChange={(event) => setDraftDisplayName(event.target.value)}
          />
          <input
            className="w-full rounded border p-2"
            placeholder="PIN (leave blank to disable)"
            type="password"
            value={draftPin}
            onChange={(event) => setDraftPin(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <button className="rounded border px-3 py-2" onClick={saveSettings}>Save settings</button>
            <button className="rounded border px-3 py-2" onClick={() => setSettingsOpen(false)}>Close</button>
            <button className="rounded border px-3 py-2" onClick={clearQueue}>Clear local queue</button>
            <button className="rounded border px-3 py-2" onClick={resetKiosk}>Reset kiosk</button>
          </div>
          <p className="text-xs text-muted-foreground">PIN is local-only. If compromised, rotate kiosk token from HR admin.</p>
        </section>
      )}

      {lastResult && (
        <section className="rounded border border-green-600 bg-green-50 p-3 text-sm">
          <div className="font-medium">{lastResult.action === "clock_in" ? "Clock In" : "Clock Out"} success</div>
          <div>{lastResult.employee.displayName}</div>
          <div>{lastResult.time}</div>
        </section>
      )}

      {error && <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </main>
  );
}
