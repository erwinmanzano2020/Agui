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

type ScanLifecycleStage =
  | "raw_input_received"
  | "token_extracted"
  | "unreadable_scan"
  | "invalid_scan"
  | "scan_started"
  | "scan_request_failed"
  | "queue_inserted"
  | "queue_insert_skipped"
  | "scan_outcome"
  | "pending_token_buffered"
  | "pending_token_consumed"
  | "sync_started"
  | "sync_result"
  | "queue_cleanup";

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
type OperatorState =
  | "ready"
  | "processing"
  | "time_in"
  | "time_out"
  | "offline_queued"
  | "scan_again"
  | "invalid_id"
  | "already_recorded"
  | "not_allowed";

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
const SCAN_DEBUG_ENV_ENABLED = process.env.NEXT_PUBLIC_HR_KIOSK_SCAN_DEBUG === "1";

function generateClientEventId(): string {
  return crypto.randomUUID();
}

function isValidQrTokenFormat(qrToken: string): boolean {
  const parts = qrToken.split(".");
  return /^v1\./i.test(qrToken) && parts.length === 3 && parts.every((part) => part.trim().length > 0);
}

function extractLatestQrToken(raw: string): string | null {
  const normalizedRaw = raw.replace(/v1\./gi, "v1.");
  const matches = normalizedRaw.match(/v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
  if (!matches || matches.length === 0) {
    return null;
  }
  const latest = matches[matches.length - 1]?.trim() ?? "";
  return isValidQrTokenFormat(latest) ? latest : null;
}

function isInvalidIdError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("invalid") || lower.includes("malformed") || lower.includes("signature") || lower.includes("token");
}

function isTerminalSyncError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("invalid")
    || lower.includes("malformed")
    || lower.includes("signature")
    || lower.includes("employee is not available")
    || lower.includes("does not match kiosk house")
  );
}

function looksLikeUnreadableScan(rawInput: string): boolean {
  const normalized = rawInput.trim();
  if (!normalized) return true;
  if (normalized.includes("v1.")) return true;
  if (/\r|\n/.test(rawInput)) return true;
  return /[A-Za-z0-9._-]{8,}/.test(normalized);
}

const clockTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

function formatTime(dateLike: Date | string): string {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return clockTimeFormatter.format(date);
}

function formatFullDate(dateLike: Date | string): string {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return fullDateFormatter.format(date);
}

function formatWeekday(dateLike: Date | string): string {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return weekdayFormatter.format(date);
}

type RecentScan = {
  id: string;
  icon: string;
  label: string;
  employeeLabel: string;
  scannedAt: Date;
};

type DiagnosticsEvent = {
  id: string;
  stage: ScanLifecycleStage;
  at: string;
  details: Record<string, unknown>;
};

type LastScanOutcomeDiagnostic =
  | "live_success"
  | "offline_queued"
  | "invalid"
  | "unreadable"
  | "already_recorded"
  | "not_allowed";

type SyncSummary = {
  processedCount: number;
  duplicateCount: number;
  discardedTerminalInvalidCount: number;
  remainingQueueCount: number;
  occurredAt: string;
};

function formatLifecycleEventDetails(stage: ScanLifecycleStage, details: Record<string, unknown>): string {
  if (stage === "sync_started") {
    return `${String(details.queued ?? 0)} queued`;
  }
  if (stage === "sync_result") {
    return `${String(details.clientEventId ?? "event")} · ${String(details.status ?? "unknown")}`;
  }
  if (stage === "queue_cleanup") {
    return `removedCompleted=${String(details.removedCompleted ?? 0)} removedTerminalErrors=${String(details.removedTerminalErrors ?? 0)}`;
  }
  if (stage === "scan_outcome") {
    return `${String(details.outcome ?? "unknown")} · queued=${String(details.queued ?? false)}`;
  }
  if (stage === "queue_inserted" || stage === "queue_insert_skipped") {
    return `queue=${String(details.queueLengthAfter ?? details.queueLengthBefore ?? "n/a")}`;
  }
  if (stage === "raw_input_received") {
    return `rawLength=${String(details.rawLength ?? 0)}`;
  }
  if (stage === "token_extracted") {
    return `extracted=${String(Boolean(details.extracted))}`;
  }
  return Object.keys(details).length > 0 ? Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(" ") : "";
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
  const [operatorState, setOperatorState] = React.useState<OperatorState>("ready");
  const [operatorSubtext, setOperatorSubtext] = React.useState<string | null>(null);
  const [scanDebugMessage, setScanDebugMessage] = React.useState<string | null>(null);
  const [lastOperatorState, setLastOperatorState] = React.useState<Exclude<OperatorState, "ready" | "processing"> | null>(null);
  const [kioskMode, setKioskMode] = React.useState<KioskMode>("setup");
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
  const [recentScans, setRecentScans] = React.useState<RecentScan[]>([]);
  const [debugQueryEnabled, setDebugQueryEnabled] = React.useState(false);
  const [recentLifecycleEvents, setRecentLifecycleEvents] = React.useState<DiagnosticsEvent[]>([]);
  const [lastScanStartedAt, setLastScanStartedAt] = React.useState<string | null>(null);
  const [lastScanEndedAt, setLastScanEndedAt] = React.useState<string | null>(null);
  const [lastScanOutcomeDiagnostic, setLastScanOutcomeDiagnostic] = React.useState<LastScanOutcomeDiagnostic | null>(null);
  const [syncInFlight, setSyncInFlight] = React.useState(false);
  const [lastSyncSummary, setLastSyncSummary] = React.useState<SyncSummary | null>(null);
  const [discardedTerminalInvalidCount, setDiscardedTerminalInvalidCount] = React.useState(0);

  const pressTimerRef = React.useRef<number | null>(null);
  const wedgeInputRef = React.useRef<HTMLInputElement | null>(null);
  const wedgeBufferRef = React.useRef("");
  const wedgeTimerRef = React.useRef<number | null>(null);
  const idleTimerRef = React.useRef<number | null>(null);
  const flashTimerRef = React.useRef<number | null>(null);
  const lastDecodedRef = React.useRef<{ value: string; at: number } | null>(null);
  const lastSubmittedRawRef = React.useRef<{ value: string; at: number } | null>(null);
  // Single-flight strategy: process one scan at a time and keep only the latest completed next token.
  const isProcessingRef = React.useRef(false);
  const pendingCompletedTokenRef = React.useRef<string | null>(null);
  const queueRef = React.useRef<QueuedEvent[]>([]);
  const syncInFlightRef = React.useRef(false);
  const scanAttemptRef = React.useRef(0);

  const diagnosticsEnabled = SCAN_DEBUG_ENV_ENABLED || debugQueryEnabled;

  const traceScanLifecycle = React.useCallback((stage: ScanLifecycleStage, details: Record<string, unknown>) => {
    if (!diagnosticsEnabled) return;
    setRecentLifecycleEvents((prev) => {
      const event: DiagnosticsEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        stage,
        at: new Date().toISOString(),
        details,
      };
      return [event, ...prev].slice(0, 10);
    });
    console.log("[kiosk-scan-debug] lifecycle", { stage, ...details });
  }, [diagnosticsEnabled]);

  const needsSetup = !kioskToken || !verifiedDeviceId;

  const connectedLabel = React.useMemo(() => resolveConnectedLabel(verifiedDevice), [verifiedDevice]);

  const recordRecentScan = React.useCallback((scan: Omit<RecentScan, "id">) => {
    const entry: RecentScan = {
      ...scan,
      id: `${scan.scannedAt.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setRecentScans((prev) => [entry, ...prev].slice(0, 3));
  }, []);

  const queueEvent = React.useCallback((event: QueuedEvent) => {
    setQueue((prev) => {
      if (prev.some((item) => item.clientEventId === event.clientEventId)) {
        traceScanLifecycle("queue_insert_skipped", {
          clientEventId: event.clientEventId,
          queueLengthBefore: prev.length,
          queueLengthAfter: prev.length,
        });
        return prev;
      }
      const next = [...prev, event];
      traceScanLifecycle("queue_inserted", {
        clientEventId: event.clientEventId,
        queueLengthBefore: prev.length,
        queueLengthAfter: next.length,
      });
      return next;
    });
  }, [traceScanLifecycle]);

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

  const showFlashAndReturn = React.useCallback((state: OperatorState, subtext?: string | null) => {
    const diagnosticOutcome: LastScanOutcomeDiagnostic | null = state === "time_in" || state === "time_out"
      ? "live_success"
      : state === "offline_queued"
        ? "offline_queued"
        : state === "invalid_id"
          ? "invalid"
          : state === "scan_again"
            ? "unreadable"
            : state === "already_recorded"
              ? "already_recorded"
              : state === "not_allowed"
                ? "not_allowed"
                : null;
    if (diagnosticOutcome) {
      setLastScanOutcomeDiagnostic(diagnosticOutcome);
    }
    setOperatorState(state);
    setOperatorSubtext(subtext ?? null);
    if (state !== "ready" && state !== "processing") {
      setLastOperatorState(state);
    }
    setKioskMode("flash_result");
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      setKioskMode("ready");
      setOperatorState("ready");
      setOperatorSubtext(null);
      focusWedgeInput();
    }, FLASH_RESULT_MS);
  }, [focusWedgeInput]);

  const processToken = React.useCallback(async (rawInput: string) => {
    const scanAttempt = ++scanAttemptRef.current;
    const clientEventId = generateClientEventId();
    const occurredAt = new Date().toISOString();
    try {
      const rawQrToken = rawInput.trim();
      if (!rawQrToken) return;

      const extractedToken = extractLatestQrToken(rawQrToken);
      traceScanLifecycle("raw_input_received", {
        scanAttempt,
        clientEventId,
        rawLength: rawInput.length,
      });
      traceScanLifecycle("token_extracted", {
        scanAttempt,
        clientEventId,
        extracted: Boolean(extractedToken),
      });

      if (diagnosticsEnabled) {
        console.log("[kiosk-scan-debug] raw scan input", { rawInput, extractedToken });
      }
      setScanDebugMessage(
        extractedToken
          ? `raw-len=${rawInput.length} extracted=${extractedToken.slice(0, 24)}...`
          : `raw-len=${rawInput.length} no-valid-token`,
      );

      if (!extractedToken) {
        setLastResult(null);
        const scannedAt = new Date();
        setLastScanAt(scannedAt);
        const shouldRetry = looksLikeUnreadableScan(rawInput);
        traceScanLifecycle(shouldRetry ? "unreadable_scan" : "invalid_scan", {
          scanAttempt,
          clientEventId,
          queued: false,
          outcome: shouldRetry ? "scan_again" : "invalid_id",
        });
        recordRecentScan({
          icon: shouldRetry ? "🔄" : "❌",
          label: shouldRetry ? "Scan again" : "Invalid ID",
          employeeLabel: shouldRetry ? "Could not read QR clearly" : "Unrecognized scan",
          scannedAt,
        });
        showFlashAndReturn(shouldRetry ? "scan_again" : "invalid_id", shouldRetry ? "Could not read QR clearly" : null);
        return;
      }

      const now = Date.now();
      const previous = lastDecodedRef.current;
      if (previous && previous.value === extractedToken && now - previous.at < DECODE_DEBOUNCE_MS) {
        setLastResult(null);
        const scannedAt = new Date();
        setLastScanAt(scannedAt);
        recordRecentScan({
          icon: "⏱️",
          label: "Already recorded",
          employeeLabel: "Please wait before scanning again",
          scannedAt,
        });
        showFlashAndReturn("already_recorded", "Please wait before scanning again");
        return;
      }
      lastDecodedRef.current = { value: extractedToken, at: now };

      if (!kioskToken) {
        setLastResult(null);
        const scannedAt = new Date();
        setLastScanAt(scannedAt);
        recordRecentScan({
          icon: "⛔",
          label: "Not allowed",
          employeeLabel: "Complete kiosk setup first",
          scannedAt,
        });
        showFlashAndReturn("not_allowed", "Complete kiosk setup first");
        return;
      }

      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      setLastResult(null);
      setOperatorState("processing");
      setOperatorSubtext("Processing scan...");
      setKioskMode("flash_result");

      const startedAtDate = new Date();
      setLastScanAt(startedAtDate);
      setLastScanStartedAt(startedAtDate.toISOString());
      traceScanLifecycle("scan_started", {
        scanAttempt,
        clientEventId,
        queueLength: queueRef.current.length,
        status,
      });

      try {
        const startedAt = performance.now();
        const response = await fetch("/api/hr/kiosk/scan", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${kioskToken}`,
          },
          body: JSON.stringify({ qrToken: extractedToken, occurredAt, clientId: clientEventId }),
        });
        const elapsedMs = Math.round(performance.now() - startedAt);
        setLastScanLatencyMs(elapsedMs);
        if (diagnosticsEnabled) {
          console.log("[kiosk-scan-debug] scan latency", { elapsedMs, status: response.status });
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          const message = payload.error ?? "Scan failed";

          if ([400, 401, 403].includes(response.status)) {
            setLastResult(null);
            setLastScanAt(new Date());
            if (message.toLowerCase().includes("debounced")) {
              showFlashAndReturn("already_recorded", "Please wait before scanning again");
              return;
            }
            if (response.status === 401) {
              showFlashAndReturn("not_allowed", "Kiosk setup required");
              return;
            }
            if (response.status === 403) {
              showFlashAndReturn("not_allowed", "Please contact admin");
              return;
            }
            if (message.toLowerCase().includes("not allowed") || message.toLowerCase().includes("not found") || message.toLowerCase().includes("house")) {
              showFlashAndReturn("not_allowed", "Please contact admin");
              return;
            }
            if (isInvalidIdError(message)) {
              traceScanLifecycle("invalid_scan", {
                scanAttempt,
                clientEventId,
                queued: false,
                reason: message,
              });
              showFlashAndReturn("invalid_id");
              return;
            }
            showFlashAndReturn("not_allowed", "Please contact admin");
            return;
          }

          throw new Error(message);
        }

        const payload = (await response.json()) as ScanResponse;
        const parsedPayloadTime = parseKioskTimestamp(payload.time);
        if (!parsedPayloadTime && payload.time && diagnosticsEnabled) {
          console.warn("[kiosk-scan-debug] rejected invalid payload time", { payloadTime: payload.time });
        }
        setLastResult(payload);
        setLastScanAt(parsedPayloadTime ?? startedAtDate);

        const resolvedScanAt = parsedPayloadTime ?? startedAtDate;
        if (payload.action === "debounced") {
          recordRecentScan({
            icon: "⏱️",
            label: "Already recorded",
            employeeLabel: payload.employee.displayName,
            scannedAt: resolvedScanAt,
          });
          showFlashAndReturn("already_recorded", "Please wait before scanning again");
          traceScanLifecycle("scan_outcome", {
            scanAttempt,
            clientEventId,
            outcome: "already_recorded",
            queued: false,
          });
          return;
        }
        recordRecentScan({
          icon: "✅",
          label: payload.action === "clock_out" ? "Time out" : "Time in",
          employeeLabel: payload.employee.displayName,
          scannedAt: resolvedScanAt,
        });
        showFlashAndReturn(payload.action === "clock_out" ? "time_out" : "time_in");
        traceScanLifecycle("scan_outcome", {
          scanAttempt,
          clientEventId,
          outcome: payload.action === "clock_out" ? "time_out" : "time_in",
          queued: false,
        });
      } catch (scanError) {
        const scannedAt = new Date();
        setLastScanAt(scannedAt);
        traceScanLifecycle("scan_request_failed", {
          scanAttempt,
          clientEventId,
          error: scanError instanceof Error ? scanError.message : "error",
        });
        queueEvent({
          clientEventId,
          qrToken: extractedToken,
          occurredAt,
        });
        setLastResult(null);
        recordRecentScan({
          icon: "📡",
          label: "Saved offline",
          employeeLabel: "Queued scan",
          scannedAt,
        });
        if (diagnosticsEnabled) {
          console.log("[kiosk-scan-debug] scan failed and queued", {
            error: scanError instanceof Error ? scanError.message : "error",
          });
        }
        showFlashAndReturn("offline_queued", "Will sync automatically when connection returns");
        traceScanLifecycle("scan_outcome", {
          scanAttempt,
          clientEventId,
          outcome: "offline_queued",
          queued: true,
        });
      }
    } finally {
      setLastScanEndedAt(new Date().toISOString());
      isProcessingRef.current = false;
      const pendingToken = pendingCompletedTokenRef.current;
      if (pendingToken) {
        traceScanLifecycle("pending_token_consumed", {
          clientEventId,
          pendingPrefix: pendingToken.slice(0, 24),
        });
        pendingCompletedTokenRef.current = null;
        isProcessingRef.current = true;
        void processToken(pendingToken);
      }
    }
  }, [diagnosticsEnabled, kioskToken, queueEvent, recordRecentScan, showFlashAndReturn, status, traceScanLifecycle]);

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

    const normalized = token.trim();
    if (!normalized) return;

    const now = Date.now();
    const lastSubmitted = lastSubmittedRawRef.current;
    if (lastSubmitted && lastSubmitted.value === normalized && now - lastSubmitted.at < 250) {
      traceScanLifecycle("queue_insert_skipped", {
        reason: "duplicate_wedge_finalize",
        pendingPrefix: normalized.slice(0, 24),
      });
      return;
    }
    lastSubmittedRawRef.current = { value: normalized, at: now };

    if (isProcessingRef.current) {
      pendingCompletedTokenRef.current = normalized;
      traceScanLifecycle("pending_token_buffered", {
        pendingPrefix: normalized.slice(0, 24),
      });
      return;
    }

    isProcessingRef.current = true;
    void processToken(normalized);
  }, [processToken, traceScanLifecycle]);

  const syncQueue = React.useCallback(async () => {
    if (syncInFlightRef.current || status !== "online" || !kioskToken) return;

    const queueSnapshot = queueRef.current;
    if (queueSnapshot.length === 0) return;

    syncInFlightRef.current = true;
    setSyncInFlight(true);
    traceScanLifecycle("sync_started", {
      queued: queueSnapshot.length,
    });

    try {
      const response = await fetch("/api/hr/kiosk/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${kioskToken}`,
        },
        body: JSON.stringify({ events: queueSnapshot }),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as {
        results: Array<{
          clientEventId: string;
          status: "duplicate" | "processed" | "error";
          result?: ScanResponse;
          error?: string;
        }>;
      };

      const completed = new Set<string>();
      const terminalFailures = new Set<string>();
      for (const item of payload.results) {
        traceScanLifecycle("sync_result", {
          clientEventId: item.clientEventId,
          status: item.status,
          error: item.status === "error" ? item.error : null,
        });
        if (item.status === "processed" || item.status === "duplicate") {
          completed.add(item.clientEventId);
          continue;
        }
        if (isTerminalSyncError(item.error ?? "")) {
          terminalFailures.add(item.clientEventId);
        }
      }

      setQueue((prev) => {
        const next = prev.filter((event) => !completed.has(event.clientEventId) && !terminalFailures.has(event.clientEventId));
        traceScanLifecycle("queue_cleanup", {
          queueLengthBefore: prev.length,
          queueLengthAfter: next.length,
          removedCompleted: completed.size,
          removedTerminalErrors: terminalFailures.size,
        });
        return next;
      });
      const processedCount = payload.results.filter((item) => item.status === "processed").length;
      const duplicateCount = payload.results.filter((item) => item.status === "duplicate").length;
      const discardedCount = terminalFailures.size;
      setDiscardedTerminalInvalidCount((prev) => prev + discardedCount);
      setLastSyncSummary({
        processedCount,
        duplicateCount,
        discardedTerminalInvalidCount: discardedCount,
        remainingQueueCount: queueSnapshot.length - completed.size - terminalFailures.size,
        occurredAt: new Date().toISOString(),
      });
      const now = new Date().toISOString();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_STORAGE_KEY, now);
    } catch {
      // keep queue for next attempt
    } finally {
      syncInFlightRef.current = false;
      setSyncInFlight(false);
    }
  }, [kioskToken, status, traceScanLifecycle]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebugQueryEnabled(params.get("debug") === "1");
  }, []);

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
    queueRef.current = queue;
  }, [queue]);

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

  function clearOperatorMemory() {
    setRecentScans([]);
    setLastResult(null);
    setLastScanAt(null);
    setLastOperatorState(null);
    setOperatorState("ready");
    setOperatorSubtext(null);
    setScanDebugMessage(null);
    setLastScanLatencyMs(null);
    setLastScanStartedAt(null);
    setLastScanEndedAt(null);
    setLastScanOutcomeDiagnostic(null);
    setRecentLifecycleEvents([]);
    setLastSyncSummary(null);
    setDiscardedTerminalInvalidCount(0);
    isProcessingRef.current = false;
    pendingCompletedTokenRef.current = null;
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
      setVerifiedDevice(null);
      setVerifiedDeviceId(null);
      clearOperatorMemory();
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
    clearOperatorMemory();
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
    setOperatorState("ready");
    setOperatorSubtext(null);
    focusWedgeInput();
  }

  function wakeKiosk() {
    if (kioskMode !== "sleep") return;
    setKioskMode("ready");
    resetIdleTimer();
    focusWedgeInput();
  }

  const flashView = operatorState === "time_in"
    ? { classes: "border-green-700 bg-green-100 text-green-900", icon: "✅", title: "TIME IN" }
    : operatorState === "time_out"
      ? { classes: "border-blue-700 bg-blue-100 text-blue-900", icon: "✅", title: "TIME OUT" }
      : operatorState === "processing"
        ? { classes: "border-amber-700 bg-amber-100 text-amber-900", icon: "⏳", title: "PROCESSING..." }
        : operatorState === "offline_queued"
          ? { classes: "border-amber-700 bg-amber-100 text-amber-900", icon: "📡", title: "OFFLINE — SAVED TO QUEUE" }
          : operatorState === "already_recorded"
            ? { classes: "border-amber-700 bg-amber-100 text-amber-900", icon: "⏱️", title: "ALREADY RECORDED" }
            : operatorState === "not_allowed"
              ? { classes: "border-slate-700 bg-slate-100 text-slate-900", icon: "⛔", title: "NOT ALLOWED" }
              : operatorState === "scan_again"
                ? { classes: "border-amber-700 bg-amber-100 text-amber-900", icon: "🔄", title: "SCAN AGAIN" }
                : { classes: "border-red-700 bg-red-100 text-red-900", icon: "❌", title: "INVALID ID" };

  const lastOutcomeTitle = lastOperatorState === "time_in"
    ? "TIME IN"
    : lastOperatorState === "time_out"
      ? "TIME OUT"
      : lastOperatorState === "offline_queued"
        ? "OFFLINE — SAVED TO QUEUE"
        : lastOperatorState === "already_recorded"
          ? "ALREADY RECORDED"
          : lastOperatorState === "not_allowed"
            ? "NOT ALLOWED"
            : lastOperatorState === "scan_again"
              ? "SCAN AGAIN"
              : lastOperatorState === "invalid_id"
                ? "INVALID ID"
                : null;

  const toastMessages = [
    settingsError ? { key: "settings", message: settingsError, tone: "error" as const } : null,
  ].filter((item): item is { key: string; message: string; tone: "error" } => item !== null);

  const parsedLastResultTime = parseKioskTimestamp(lastResult?.time);
  const scanTimestamp = parsedLastResultTime ?? lastScanAt;
  const scanTimestampLabel = scanTimestamp ? formatTime(scanTimestamp) : null;
  const fullDateLabel = `${formatFullDate(now)} · ${formatWeekday(now)}`;
  const lastSyncLabel = lastSyncAt ? formatTime(lastSyncAt) : "Never";
  const lastScanStartedLabel = lastScanStartedAt ? formatTime(lastScanStartedAt) : "n/a";
  const lastScanEndedLabel = lastScanEndedAt ? formatTime(lastScanEndedAt) : "n/a";

  return (
    <main
      className="relative mx-auto flex min-h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
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

          const currentValue = event.currentTarget.value;
          wedgeBufferRef.current = currentValue;

          if (/\r|\n/.test(currentValue)) {
            const completedChunks = currentValue
              .split(/[\r\n]+/)
              .map((chunk) => chunk.trim())
              .filter((chunk) => chunk.length > 0);
            const latestCompleted = completedChunks[completedChunks.length - 1];
            if (latestCompleted) {
              flushWedgeBuffer(latestCompleted);
              return;
            }
          }

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

          if (event.key === "Enter" || event.key === "NumpadEnter") {
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
        <section className="relative mt-3 flex min-h-[46vh] flex-1 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/95 p-5 text-center shadow-sm sm:min-h-[56vh] sm:p-8">
          <div>
            <div className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-7xl">{formatTime(now)}</div>
            <div className="mt-2 text-base text-slate-700 sm:text-xl">{fullDateLabel}</div>
          </div>

          <div className="mt-6">
            <div className="text-2xl font-semibold text-slate-900 sm:text-3xl">Ready to scan</div>
            <div className="mt-2 text-sm text-slate-600 sm:text-base">Present employee QR</div>
          </div>

          <div className="mt-6 min-h-10 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {lastResult?.employee && scanTimestampLabel ? (
              <>
                <div className="font-medium">Last recorded: {lastResult.employee.displayName} · {lastResult.action === "clock_out" ? "Time out" : "Time in"}</div>
                <div className="mt-1 text-xs text-slate-500 sm:text-sm">{scanTimestampLabel}</div>
              </>
            ) : scanTimestampLabel && lastOutcomeTitle ? (
              <>
                <div className="font-medium">Last recorded: {lastOutcomeTitle}</div>
                <div className="mt-1 text-xs text-slate-500 sm:text-sm">{scanTimestampLabel}</div>
              </>
            ) : (
              <div>Waiting for first scan</div>
            )}
          </div>

          {kioskMode === "flash_result" && (
            <div className={`absolute inset-4 z-20 flex flex-col items-center justify-center rounded-xl border-2 ${flashView.classes}`}>
              <div className="text-4xl">{flashView.icon}</div>
              <div className="mt-2 text-3xl font-semibold">{flashView.title}</div>
              {operatorSubtext ? <div className="mt-2 text-lg">{operatorSubtext}</div> : null}
              {lastResult?.employee ? <div className="mt-2 text-lg">{lastResult.employee.displayName}</div> : null}
            </div>
          )}
        </section>
      )}

      {!needsSetup && !setupOpen && (
        <>
          <div className="mt-2 rounded border p-2 text-xs">Status: <strong>{status}</strong> · Queued: {queue.length} · Last sync: {lastSyncAt ?? "Never"}</div>
          <div className="mt-2 rounded border p-2 text-xs" data-testid="kiosk-connected-banner">{connectedLabel ?? "Not verified yet (offline mode)"}</div>
          {diagnosticsEnabled ? (
            <details className="mt-2 rounded border border-indigo-200 bg-indigo-50/60 p-2 text-xs text-indigo-950" open>
              <summary className="cursor-pointer font-semibold">Diagnostics (debug mode)</summary>
              <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                <div>Last latency: {lastScanLatencyMs !== null ? `${lastScanLatencyMs}ms` : "n/a"}</div>
                <div>Last scan state: {lastScanOutcomeDiagnostic ?? "n/a"}</div>
                <div>Scan started: {lastScanStartedLabel}</div>
                <div>Scan ended: {lastScanEndedLabel}</div>
                <div>Queue: {queue.length}</div>
                <div>Sync in progress: {syncInFlight ? "yes" : "no"}</div>
                <div>Last sync: {lastSyncLabel}</div>
                <div>Discarded invalid (session): {discardedTerminalInvalidCount}</div>
              </div>
              {lastSyncSummary ? (
                <div className="mt-2 rounded border border-indigo-200 bg-white/80 p-2">
                  Last sync summary · processed={lastSyncSummary.processedCount} · duplicates={lastSyncSummary.duplicateCount} · terminal-invalid/discarded={lastSyncSummary.discardedTerminalInvalidCount} · remaining={lastSyncSummary.remainingQueueCount}
                </div>
              ) : null}
              <div className="mt-2">
                <div className="font-medium">Recent lifecycle events</div>
                {recentLifecycleEvents.length === 0 ? (
                  <div className="text-indigo-800/80">Waiting for events...</div>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {recentLifecycleEvents.slice(0, 10).map((event) => (
                      <li key={event.id} className="truncate">
                        {event.stage} · {formatLifecycleEventDetails(event.stage, event.details)} · {formatTime(event.at)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ) : null}
          <div className="mt-2 hidden rounded border border-slate-200 bg-white p-2 text-xs sm:block">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Recent scans</div>
            {recentScans.length === 0 ? (
              <div className="mt-1 text-muted-foreground">Waiting for scans...</div>
            ) : (
              <ul className="mt-1 space-y-1 text-slate-700">
                {recentScans.map((scan) => (
                  <li key={scan.id} className="truncate">{scan.icon} {scan.employeeLabel} · {scan.label} · {formatTime(scan.scannedAt)}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Last scan: {lastResult ? `✅ ${lastResult.employee.displayName} · ${lastResult.action === "clock_out" ? "Time out" : "Time in"}${scanTimestampLabel ? ` · ${scanTimestampLabel}` : ""}` : scanTimestampLabel && lastOutcomeTitle ? `${lastOutcomeTitle} · ${scanTimestampLabel}` : "Waiting for scan..."}
            {diagnosticsEnabled && lastScanLatencyMs !== null ? ` · ${lastScanLatencyMs}ms` : ""}
            {diagnosticsEnabled && scanDebugMessage ? ` · ${scanDebugMessage}` : ""}
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
