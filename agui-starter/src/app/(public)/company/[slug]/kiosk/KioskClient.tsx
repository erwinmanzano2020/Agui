"use client";

import * as React from "react";

import { resolveConnectedLabel } from "@/lib/hr/kiosk/connected-label";
import {
  getScannerStrategy,
  loadJsQrDecoder,
  runScanActionSafely,
} from "@/lib/hr/kiosk/scanner-fallback";
import {
  shouldSubmitKeyboardWedge,
  stopStreamTracks,
  transitionCameraState,
  type CameraState,
} from "@/lib/hr/kiosk/scan-session";

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
const VERIFIED_DEVICE_NAME_STORAGE_KEY = "hr-kiosk-verified-device-name";
const VERIFIED_BRANCH_LABEL_STORAGE_KEY = "hr-kiosk-verified-branch-label";
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
  const [cameraState, setCameraState] = React.useState<CameraState>("idle");
  const [manualQr, setManualQr] = React.useState("");
  const [scanHint, setScanHint] = React.useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = React.useState<string | null>(null);
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
  const manualInputRef = React.useRef<HTMLInputElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanLoopRafRef = React.useRef<number | null>(null);
  const scanTimeoutRef = React.useRef<number | null>(null);

  const needsSetup = !kioskToken || !verifiedDeviceId;

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

  React.useEffect(() => {
    if (cameraState !== "scanning") {
      manualInputRef.current?.focus();
    }
  }, [cameraState]);

  React.useEffect(() => {
    return () => {
      if (scanLoopRafRef.current) window.cancelAnimationFrame(scanLoopRafRef.current);
      if (scanTimeoutRef.current) window.clearTimeout(scanTimeoutRef.current);
      stopStreamTracks(streamRef.current);
    };
  }, []);

  const connectedLabel = React.useMemo(
    () => resolveConnectedLabel(verifiedDevice),
    [verifiedDevice],
  );

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
        setLastScanAt(new Date().toISOString());
        setScanHint(null);
        setError(null);
      } catch (scanError) {
        queueEvent(qrToken);
        setLastResult(null);
        setError(`Offline/failed. Queued for sync. (${scanError instanceof Error ? scanError.message : "error"})`);
      } finally {
        setManualQr("");
        manualInputRef.current?.focus();
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
    await runScanActionSafely(async () => {
      setError(null);
      setScanHint(null);
      setCameraState((current) => transitionCameraState(current, "start"));

      if (scanLoopRafRef.current) {
        window.cancelAnimationFrame(scanLoopRafRef.current);
        scanLoopRafRef.current = null;
      }
      if (scanTimeoutRef.current) {
        window.clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      stopStreamTracks(streamRef.current);
      streamRef.current = null;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch (cameraError) {
        if (cameraError instanceof DOMException && cameraError.name === "NotAllowedError") {
          setCameraState((current) => transitionCameraState(current, "deny"));
          setError("Camera permission denied");
          return;
        }
        setCameraState((current) => transitionCameraState(current, "fail"));
        setError("Unable to access camera.");
        return;
      }

      streamRef.current = stream;

      const activeVideo = videoRef.current;
      if (!activeVideo) {
        stopStreamTracks(stream);
        streamRef.current = null;
        setCameraState((current) => transitionCameraState(current, "fail"));
        setError("Camera preview is unavailable.");
        return;
      }

      activeVideo.srcObject = stream;
      try {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            activeVideo.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          };
          activeVideo.addEventListener("loadedmetadata", onLoaded);
          window.setTimeout(() => {
            activeVideo.removeEventListener("loadedmetadata", onLoaded);
            reject(new Error("Camera preview took too long to initialize."));
          }, 5000);
        });
      } catch {
        stopStreamTracks(streamRef.current);
        streamRef.current = null;
        setCameraState((current) => transitionCameraState(current, "fail"));
        setError("Unable to initialize camera preview.");
        return;
      }

      try {
        await activeVideo.play();
      } catch {
        stopStreamTracks(stream);
        streamRef.current = null;
        setCameraState((current) => transitionCameraState(current, "fail"));
        setError("Unable to start camera preview.");
        return;
      }

      setCameraState((current) => transitionCameraState(current, "ready"));

      scanTimeoutRef.current = window.setTimeout(() => {
        setScanHint("No QR detected yet—try better lighting, move closer, or use manual input.");
      }, 30000);

      const strategy = getScannerStrategy("BarcodeDetector" in window);

      if (strategy === "barcode_detector") {
        const DetectorCtor = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
        if (!DetectorCtor) {
          stopStreamTracks(streamRef.current);
          streamRef.current = null;
          setCameraState((current) => transitionCameraState(current, "fail"));
          setError("Camera scanner is unavailable on this browser.");
          return;
        }

        const detector = new DetectorCtor({ formats: ["qr_code"] });
        const run = async () => {
          try {
            const video = videoRef.current;
            if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
              scanLoopRafRef.current = window.requestAnimationFrame(() => {
                void run();
              });
              return;
            }

            const codes = await detector.detect(video);
            if (codes.length > 0 && codes[0].rawValue) {
              stopCamera();
              await sendScan(codes[0].rawValue);
              return;
            }
          } catch {
            // retry loop
          }
          scanLoopRafRef.current = window.requestAnimationFrame(() => {
            void run();
          });
        };

        void run();
        return;
      }

      const jsQrDecode = await loadJsQrDecoder(document);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        stopStreamTracks(streamRef.current);
        streamRef.current = null;
        setCameraState((current) => transitionCameraState(current, "fail"));
        setError("Camera scanner canvas is unavailable.");
        return;
      }

      const runFallback = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
          scanLoopRafRef.current = window.requestAnimationFrame(() => {
            void runFallback();
          });
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQrDecode(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (decoded?.data) {
          stopCamera();
          await sendScan(decoded.data);
          return;
        }

        scanLoopRafRef.current = window.requestAnimationFrame(() => {
          void runFallback();
        });
      };

      void runFallback();
    });
  }

  function stopCamera() {
    if (scanLoopRafRef.current) {
      window.cancelAnimationFrame(scanLoopRafRef.current);
      scanLoopRafRef.current = null;
    }
    if (scanTimeoutRef.current) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    stopStreamTracks(streamRef.current);
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    setScanHint(null);
    setCameraState((current) => transitionCameraState(current, "stop"));
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
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">HR Kiosk</h1>

      <div className="rounded border p-3 text-sm">
        Status: <strong>{status === "online" ? "Online" : "Offline"}</strong> (Queued: {queue.length})
      </div>

      <div className="rounded border p-3 text-sm" data-testid="kiosk-connected-banner">
        {connectedLabel ?? "Not verified yet (offline mode)"}
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
                  ✅ {connectedLabel}
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
            <button type="button" className="w-full rounded bg-black px-3 py-3 text-white" onClick={() => void startCameraScan()}>
              Open Camera Scanner
            </button>
            {cameraState !== "idle" ? (
              <button type="button" className="w-full rounded border px-3 py-2" onClick={stopCamera}>
                Stop camera
              </button>
            ) : null}
            {cameraState === "starting" ? <p className="text-xs text-muted-foreground">Starting camera…</p> : null}
            {cameraState === "scanning" ? <p className="text-xs text-muted-foreground">Scanning…</p> : null}
            {cameraState === "permission_denied" ? <p className="text-xs text-red-600">Camera permission denied</p> : null}
            {cameraState === "scanning" ? <p className="text-xs text-green-700">Ready</p> : null}
            {scanHint ? <p className="text-xs text-amber-700">{scanHint}</p> : null}
            {lastScanAt ? <p className="text-xs text-muted-foreground">Last scan: {new Date(lastScanAt).toLocaleTimeString()}</p> : null}
            {cameraState !== "idle" ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded border bg-black"
              />
            ) : null}
            <div className="flex gap-2">
              <input
                ref={manualInputRef}
                className="w-full rounded border p-2"
                placeholder="Manual QR token fallback"
                value={manualQr}
                onChange={(event) => setManualQr(event.target.value)}
                onKeyDown={(event) => {
                  if (shouldSubmitKeyboardWedge(event.key, manualQr)) {
                    event.preventDefault();
                    void sendScan(manualQr.trim());
                  }
                }}
              />
              <button
                type="button"
                className="rounded border px-3 py-2"
                onClick={() => {
                  setManualQr("");
                  manualInputRef.current?.focus();
                }}
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              className="w-full rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!manualQr.trim()}
              onClick={() => void sendScan(manualQr.trim())}
            >
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
