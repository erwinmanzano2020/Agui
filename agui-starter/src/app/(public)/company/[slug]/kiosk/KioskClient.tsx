"use client";

import * as React from "react";

import { resolveConnectedLabel } from "@/lib/hr/kiosk/connected-label";
import { parseKioskTimestamp } from "@/lib/hr/kiosk/timestamp";
import {
  shouldAutoFocusWedge,
  shouldCaptureWedgeInput,
  type KioskMode as WedgeKioskMode,
  type SetupStep as WedgeSetupStep,
} from "@/lib/hr/kiosk/wedge-focus";

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

type SetupStep = WedgeSetupStep;
type KioskMode = WedgeKioskMode;
type FlashTone = "time_in" | "time_out" | "error" | "processing";

const TOKEN_STORAGE_KEY = "hr-kiosk-token";
const PIN_STORAGE_KEY = "hr-kiosk-pin";
const QUEUE_STORAGE_KEY = "hr-kiosk-queue";
const DISPLAY_NAME_STORAGE_KEY = "hr-kiosk-display-name";
const VERIFIED_DEVICE_ID_STORAGE_KEY = "hr-kiosk-verified-device-id";
const VERIFIED_DEVICE_NAME_STORAGE_KEY = "hr-kiosk-verified-device-name";
const VERIFIED_BRANCH_LABEL_STORAGE_KEY = "hr-kiosk-verified-branch-label";
const LAST_SYNC_STORAGE_KEY = "hr-kiosk-last-sync-at";

const IDLE_TIMEOUT_MS = 180_000;
const FLASH_RESULT_MS = 1500;
const WEDGE_SUBMIT_TIMEOUT_MS = 120;
const DECODE_DEBOUNCE_MS = 1200;
const SCAN_DEBUG_ENABLED = process.env.NEXT_PUBLIC_HR_KIOSK_SCAN_DEBUG === "1";

function generateClientEventId(): string {
  return crypto.randomUUID();
}

function isValidQrTokenFormat(qrToken: string): boolean {
  const parts = qrToken.split(".");
  return /^v1\./i.test(qrToken) && parts.length === 3 && parts.every((part) => part.trim().length > 0);
}

const clockTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatTime(dateLike: Date | string): string {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return clockTimeFormatter.format(date);
}

function formatShortDate(dateLike: Date | string): string {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return shortDateFormatter.format(date);
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
  const [kioskMode, setKioskMode] = React.useState<KioskMode>("setup");
  const [flashTone, setFlashTone] = React.useState<FlashTone | null>(null);
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
  const [lastScanLatencyMs, setLastScanLatencyMs] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(() => new Date());
  const [lastScanAt, setLastScanAt] = React.useState<Date | null>(null);

  const pressTimerRef = React.useRef<number | null>(null);
  const wedgeInputRef = React.useRef<HTMLInputElement | null>(null);
  const wedgeBufferRef = React.useRef("");
  const wedgeTimerRef = React.useRef<number | null>(null);
  const idleTimerRef = React.useRef<number | null>(null);
  const flashTimerRef = React.useRef<number | null>(null);
  const lastDecodedRef = React.useRef<{ value: string; at: number } | null>(null);

  const needsSetup = !kioskToken || !verifiedDeviceId;

  const connectedLabel = React.useMemo(() => resolveConnectedLabel(verifiedDevice), [verifiedDevice]);

  const queueEvent = React.useCallback((qrToken: string) => {
    const event: QueuedEvent = {
      clientEventId: generateClientEventId(),
      qrToken,
      occurredAt: new Date().toISOString(),
    };
    setQueue((prev) => [...prev, event]);
  }, []);

  const focusWedgeInput = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      wedgeInputRef.current?.focus();
    });
  }, []);

  const resetIdleTimer = React.useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (needsSetup || kioskMode === "setup") {
      return;
    }

    idleTimerRef.current = window.setTimeout(() => {
      setKioskMode("sleep");
    }, IDLE_TIMEOUT_MS);
  }, [kioskMode, needsSetup]);

  const showFlashAndReturn = React.useCallback((tone: FlashTone) => {
    setFlashTone(tone);
    setKioskMode("flash_result");
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      setKioskMode("ready");
      setFlashTone(null);
      focusWedgeInput();
    }, FLASH_RESULT_MS);
  }, [focusWedgeInput]);

  const processToken = React.useCallback(async (rawQrToken: string) => {
    const qrToken = rawQrToken.trim().replace(/^v1\./i, "v1.");
    if (!qrToken) return;

    if (!isValidQrTokenFormat(qrToken)) {
      const parts = qrToken.split(".");
      const formatError = `Invalid QR token format. (len=${qrToken.length} dots=${Math.max(0, parts.length - 1)} parts=${parts.length} prefix=${qrToken.slice(0, 12)} nl=${rawQrToken.includes("\n") ? "1" : "0"} cr=${rawQrToken.includes("\r") ? "1" : "0"} tab=${rawQrToken.includes("\t") ? "1" : "0"})`;
      if (SCAN_DEBUG_ENABLED) {
        console.log("[kiosk-scan-debug] invalid format", { raw: rawQrToken, normalized: qrToken, length: qrToken.length, parts: parts.length });
      }
      setError(formatError);
      setLastResult(null);
      setLastScanAt(new Date());
      showFlashAndReturn("error");
      return;
    }

    const now = Date.now();
    const previous = lastDecodedRef.current;
    if (previous && previous.value === qrToken && now - previous.at < DECODE_DEBOUNCE_MS) {
      return;
    }
    lastDecodedRef.current = { value: qrToken, at: now };

    if (!kioskToken) {
      setError("Complete kiosk setup first.");
      setLastResult(null);
      setLastScanAt(new Date());
      showFlashAndReturn("error");
      return;
    }

    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setError(null);
    setLastResult(null);
    setFlashTone("processing");
    setKioskMode("flash_result");

    const startedAtDate = new Date();
    setLastScanAt(startedAtDate);

    try {
      const startedAt = performance.now();
      const response = await fetch("/api/hr/kiosk/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${kioskToken}`,
        },
        body: JSON.stringify({ qrToken, occurredAt: new Date().toISOString() }),
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      setLastScanLatencyMs(elapsedMs);
      if (SCAN_DEBUG_ENABLED) {
        console.log("[kiosk-scan-debug] scan latency", { elapsedMs, status: response.status });
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const message = payload.error ?? "Scan failed";

        if ([400, 401, 403].includes(response.status)) {
          setLastResult(null);
          setError(message);
          showFlashAndReturn("error");
          return;
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as ScanResponse;
      const parsedPayloadTime = parseKioskTimestamp(payload.time);
      if (!parsedPayloadTime && payload.time && SCAN_DEBUG_ENABLED) {
        console.warn("[kiosk-scan-debug] rejected invalid payload time", { payloadTime: payload.time });
      }
      setLastResult(payload);
      setLastScanAt(parsedPayloadTime ?? startedAtDate);
      setError(null);
      showFlashAndReturn(payload.action === "clock_out" ? "time_out" : "time_in");
    } catch (scanError) {
      setLastScanAt(new Date());
      queueEvent(qrToken);
      setLastResult(null);
      setError(`Offline/failed. Queued for sync. (${scanError instanceof Error ? scanError.message : "error"})`);
      showFlashAndReturn("error");
    }
  }, [kioskToken, queueEvent, showFlashAndReturn]);

  const flushWedgeBuffer = React.useCallback((tokenOverride?: string) => {
    const token = tokenOverride ?? wedgeInputRef.current?.value ?? wedgeBufferRef.current;
    wedgeBufferRef.current = "";
    if (wedgeInputRef.current) {
      wedgeInputRef.current.value = "";
    }
    if (wedgeTimerRef.current) {
      window.clearTimeout(wedgeTimerRef.current);
      wedgeTimerRef.current = null;
    }
    void processToken(token);
  }, [processToken]);

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
      setQueue((prev) => prev.filter((event) => !completed.has(event.clientEventId)));
      const now = new Date().toISOString();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_STORAGE_KEY, now);
    } catch {
      // keep queue for next attempt
    }
  }, [kioskToken, queue, status]);

  React.useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    const savedPin = localStorage.getItem(PIN_STORAGE_KEY) ?? "";
    const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    const savedDisplayName = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? "";
    const savedVerifiedDeviceId = localStorage.getItem(VERIFIED_DEVICE_ID_STORAGE_KEY);
    const savedVerifiedDeviceName = localStorage.getItem(VERIFIED_DEVICE_NAME_STORAGE_KEY);
    const savedVerifiedBranchLabel = localStorage.getItem(VERIFIED_BRANCH_LABEL_STORAGE_KEY);
    const savedLastSyncAt = localStorage.getItem(LAST_SYNC_STORAGE_KEY);

    setKioskToken(savedToken);
    setDraftToken(savedToken);
    setPin(savedPin);
    setDraftPin(savedPin);
    setDisplayName(savedDisplayName);
    setDraftDisplayName(savedDisplayName);
    setVerifiedDeviceId(savedVerifiedDeviceId);
    setLastSyncAt(savedLastSyncAt);

    if (savedVerifiedDeviceId && (savedVerifiedDeviceName || savedVerifiedBranchLabel)) {
      setVerifiedDevice({
        id: savedVerifiedDeviceId,
        name: savedVerifiedDeviceName ?? savedDisplayName ?? "",
        branch_id: savedVerifiedBranchLabel ?? "",
        branch_name: savedVerifiedBranchLabel,
      });
    }

    if (savedQueue) {
      try {
        setQueue(JSON.parse(savedQueue) as QueuedEvent[]);
      } catch {
        setQueue([]);
      }
    }

    const requiresSetup = !savedToken || !savedVerifiedDeviceId;
    setSetupOpen(requiresSetup);
    setKioskMode(requiresSetup ? "setup" : "ready");

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

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void syncQueue();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [syncQueue]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (shouldAutoFocusWedge({ kioskMode, settingsOpen, setupOpen, setupStep })) {
      focusWedgeInput();
    }
  }, [focusWedgeInput, kioskMode, settingsOpen, setupOpen, setupStep]);

  React.useEffect(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  React.useEffect(() => {
    return () => {
      if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (wedgeTimerRef.current) window.clearTimeout(wedgeTimerRef.current);
    };
  }, []);

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
      localStorage.removeItem(VERIFIED_DEVICE_NAME_STORAGE_KEY);
      localStorage.removeItem(VERIFIED_BRANCH_LABEL_STORAGE_KEY);
      setVerifiedDeviceId(null);
      setSetupOpen(true);
      setSetupStep("verify");
      setVerifyError("Token changed. Re-verify connection.");
      setKioskMode("setup");
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
    localStorage.removeItem(VERIFIED_DEVICE_NAME_STORAGE_KEY);
    localStorage.removeItem(VERIFIED_BRANCH_LABEL_STORAGE_KEY);
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
    setKioskMode("setup");
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
      localStorage.setItem(VERIFIED_DEVICE_NAME_STORAGE_KEY, verifiedDevice.name ?? "");
      localStorage.setItem(VERIFIED_BRANCH_LABEL_STORAGE_KEY, verifiedDevice.branch_name ?? verifiedDevice.branch_id);
      setVerifiedDeviceId(verifiedDevice.id);
    }

    setKioskToken(tokenToSave);
    setPin(draftPin);
    setDisplayName(draftDisplayName);
    setSetupStep("harden");
    setKioskMode("ready");
    setSetupOpen(false);
    setError(null);
    focusWedgeInput();
  }

  function wakeKiosk() {
    if (kioskMode !== "sleep") return;
    setKioskMode("ready");
    resetIdleTimer();
    focusWedgeInput();
  }

  const flashView = flashTone === "time_in"
    ? { classes: "border-green-700 bg-green-100 text-green-900", icon: "✅", title: "TIME IN" }
    : flashTone === "time_out"
      ? { classes: "border-blue-700 bg-blue-100 text-blue-900", icon: "✅", title: "TIME OUT" }
      : flashTone === "processing"
        ? { classes: "border-amber-700 bg-amber-100 text-amber-900", icon: "⏳", title: "PROCESSING..." }
      : { classes: "border-red-700 bg-red-100 text-red-900", icon: "❌", title: "ERROR / INVALID QR" };

  const toastMessages = [
    settingsError ? { key: "settings", message: settingsError } : null,
    error ? { key: "scan", message: error } : null,
  ].filter((item): item is { key: string; message: string } => item !== null);

  const parsedLastResultTime = parseKioskTimestamp(lastResult?.time);
  const scanTimestamp = parsedLastResultTime ?? lastScanAt;
  const scanTimestampLabel = scanTimestamp ? `${formatTime(scanTimestamp)} (${formatShortDate(scanTimestamp)})` : null;

  return (
    <main
      className="relative mx-auto flex min-h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      onPointerDown={() => {
        if (!needsSetup) {
          resetIdleTimer();
        }
      }}
    >
      <input
        ref={wedgeInputRef}
        aria-hidden
        autoComplete="off"
        className="pointer-events-none absolute -left-[9999px] h-1 w-1 opacity-0"
        onBlur={() => {
          if (shouldAutoFocusWedge({ kioskMode, settingsOpen, setupOpen, setupStep })) {
            focusWedgeInput();
          }
        }}
        onInput={(event) => {
          if (!shouldCaptureWedgeInput({ kioskMode, settingsOpen, setupOpen, setupStep }) || needsSetup) return;
          resetIdleTimer();

          wedgeBufferRef.current = event.currentTarget.value;
          if (wedgeTimerRef.current) {
            window.clearTimeout(wedgeTimerRef.current);
          }
          wedgeTimerRef.current = window.setTimeout(() => {
            flushWedgeBuffer();
          }, WEDGE_SUBMIT_TIMEOUT_MS);
        }}
        onKeyDown={(event) => {
          if (!shouldCaptureWedgeInput({ kioskMode, settingsOpen, setupOpen, setupStep }) || needsSetup) return;
          resetIdleTimer();

          if (event.key === "Enter") {
            event.preventDefault();
            flushWedgeBuffer(event.currentTarget.value);
          }
        }}
      />

      <h1 className="text-2xl font-semibold">HR Kiosk</h1>

      {(setupOpen || needsSetup) && (
        <section className="mt-3 max-h-[62vh] space-y-3 overflow-y-auto rounded border bg-white p-4 text-sm">
          <h2 className="text-lg font-semibold">Kiosk Setup Wizard</h2>

          {setupStep === "welcome" && (
            <div className="space-y-2">
              <p>Workspace: <strong>{slug}</strong></p>
              <p>Branch context: <strong>{verifiedDevice?.branch_name ?? "Not yet verified"}</strong></p>
              <button className="rounded border px-3 py-2" onClick={() => setSetupStep("token")}>Start setup</button>
            </div>
          )}

          {setupStep === "token" && (
            <div className="space-y-2">
              <label className="block font-medium">Enter kiosk token</label>
              <input className="w-full rounded border p-2" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="Paste x-kiosk-token" />
              <div className="flex gap-2">
                <button className="rounded border px-3 py-2" onClick={() => setSetupStep("welcome")}>Back</button>
                <button className="rounded border px-3 py-2" disabled={!draftToken.trim()} onClick={() => setSetupStep("verify")}>Continue</button>
              </div>
            </div>
          )}

          {setupStep === "verify" && (
            <div className="space-y-2">
              <button className="rounded border px-3 py-2" onClick={async () => {
                const ok = await verifyToken(draftToken.trim());
                if (ok) setSetupStep("confirm");
              }} disabled={!draftToken.trim()}>
                Verify connection
              </button>
              {verifiedDevice ? <div className="rounded border border-green-500 bg-green-50 p-2">✅ {connectedLabel}</div> : null}
              {verifyError ? <div className="rounded border border-red-500 bg-red-50 p-2">❌ {verifyError}</div> : null}
              <div className="flex gap-2">
                <button className="rounded border px-3 py-2" onClick={() => setSetupStep("token")}>Back</button>
                <button className="rounded border px-3 py-2" onClick={() => { setAllowOfflineSetup(true); setSetupStep("confirm"); }}>Continue offline</button>
              </div>
            </div>
          )}

          {setupStep === "confirm" && (
            <div className="space-y-2">
              <input className="w-full rounded border p-2" placeholder="Display name" value={draftDisplayName} onChange={(event) => setDraftDisplayName(event.target.value)} />
              <input className="w-full rounded border p-2" placeholder="PIN (optional)" type="password" value={draftPin} onChange={(event) => setDraftPin(event.target.value)} />
              <div className="flex gap-2">
                <button className="rounded border px-3 py-2" onClick={() => setSetupStep("verify")}>Back</button>
                <button className="rounded border px-3 py-2" onClick={finishSetup}>Finish setup</button>
              </div>
            </div>
          )}

          {setupStep === "harden" ? <div className="rounded border border-green-500 bg-green-50 p-2">✅ Setup complete. Scanner ready.</div> : null}
        </section>
      )}

      {!needsSetup && !setupOpen && (
        <section className="relative mt-3 flex min-h-[40vh] max-h-[56vh] flex-1 flex-col items-center justify-center rounded border bg-slate-50 p-4 text-center">
          <div className="text-sm text-muted-foreground">Scanner kiosk</div>
          <div className="mt-1 text-sm text-muted-foreground">Current time: {formatTime(now)} ({formatShortDate(now)})</div>
          <div className="mt-3 text-4xl font-bold">Scan ID</div>
          <div className="mt-2 text-sm text-muted-foreground">Present employee QR to scanner</div>
          {scanTimestampLabel ? <div className="mt-2 text-sm text-muted-foreground">Last scan time: {scanTimestampLabel}</div> : null}

          {kioskMode === "flash_result" && (
            <div className={`absolute inset-4 z-20 flex flex-col items-center justify-center rounded-xl border-2 ${flashView.classes}`}>
              <div className="text-4xl">{flashView.icon}</div>
              <div className="mt-2 text-3xl font-semibold">{flashView.title}</div>
              {flashTone === "processing" ? <div className="mt-2 text-lg">Processing scan…</div> : null}
              {lastResult?.employee ? <div className="mt-2 text-lg">{lastResult.employee.displayName}</div> : null}
            </div>
          )}
        </section>
      )}

      {!needsSetup && !setupOpen && (
        <>
          <div className="mt-2 rounded border p-2 text-xs">Status: <strong>{status}</strong> · Queued: {queue.length} · Last sync: {lastSyncAt ?? "Never"}</div>
          <div className="mt-2 rounded border p-2 text-xs" data-testid="kiosk-connected-banner">{connectedLabel ?? "Not verified yet (offline mode)"}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Last scan: {error ? `❌ ${error}${scanTimestampLabel ? ` · ${scanTimestampLabel}` : ""}` : lastResult ? `✅ ${lastResult.employee.displayName} · ${lastResult.action === "clock_out" ? "Time out" : "Time in"}${scanTimestampLabel ? ` · ${scanTimestampLabel}` : ""}` : "Waiting for scan..."}
            {SCAN_DEBUG_ENABLED && lastScanLatencyMs !== null ? ` · ${lastScanLatencyMs}ms` : ""}
          </div>
        </>
      )}

      <button
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 rounded border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow"
        onClick={openSettingsWithGuard}
        onMouseDown={startLongPress}
        onMouseUp={stopLongPress}
        onMouseLeave={stopLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={stopLongPress}
      >
        Settings
      </button>

      {toastMessages.length > 0 ? (
        <div className="fixed left-3 right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 space-y-2">
          {toastMessages.map((toast) => (
            <div key={toast.key} className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-700">
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}

      {settingsOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <section className="max-h-[85dvh] w-full space-y-2 overflow-y-auto rounded border bg-background p-3 text-sm shadow-xl">
            <h2 className="font-medium">Kiosk Settings</h2>
            <p>Device: {displayName || verifiedDevice?.name || "Unnamed"}</p>
            <p>Last sync: {lastSyncAt ?? "Never"}</p>
            <p>Queue length: {queue.length}</p>
            <p>Connectivity: {status}</p>

            <input className="w-full rounded border p-2" placeholder="Kiosk token" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} />
            <input className="w-full rounded border p-2" placeholder="Display name" value={draftDisplayName} onChange={(event) => setDraftDisplayName(event.target.value)} />
            <input className="w-full rounded border p-2" placeholder="PIN (leave blank to disable)" type="password" value={draftPin} onChange={(event) => setDraftPin(event.target.value)} />

            <div className="flex flex-wrap gap-2">
              <button className="rounded border px-3 py-2" onClick={saveSettings}>Save settings</button>
              <button className="rounded border px-3 py-2" onClick={() => setSettingsOpen(false)}>Close</button>
              <button className="rounded border px-3 py-2" onClick={clearQueue}>Clear local queue</button>
              <button className="rounded border px-3 py-2" onClick={resetKiosk}>Reset kiosk</button>
            </div>
          </section>
        </div>
      )}

      {kioskMode === "sleep" && (
        <div
          role="button"
          tabIndex={0}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 text-center text-white"
          onClick={wakeKiosk}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              wakeKiosk();
            }
          }}
        >
          <div>
            <div className="text-2xl font-semibold">Tap anywhere to wake</div>
          </div>
        </div>
      )}
    </main>
  );
}
