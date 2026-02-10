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

const TOKEN_STORAGE_KEY = "hr-kiosk-token";
const PIN_STORAGE_KEY = "hr-kiosk-pin";
const QUEUE_STORAGE_KEY = "hr-kiosk-queue";

function generateClientEventId(): string {
  return crypto.randomUUID();
}

export default function KioskClient() {
  const [kioskToken, setKioskToken] = React.useState("");
  const [pin, setPin] = React.useState("1234");
  const [status, setStatus] = React.useState<"online" | "offline">(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
  );
  const [queue, setQueue] = React.useState<QueuedEvent[]>([]);
  const [lastResult, setLastResult] = React.useState<ScanResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [manualQr, setManualQr] = React.useState("");

  React.useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    const savedPin = localStorage.getItem(PIN_STORAGE_KEY) ?? "1234";
    const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);

    setKioskToken(savedToken);
    setPin(savedPin);
    if (savedQueue) {
      try {
        setQueue(JSON.parse(savedQueue) as QueuedEvent[]);
      } catch {
        setQueue([]);
      }
    }

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
        setError("Set kiosk token first.");
        return;
      }

      try {
        const response = await fetch("/api/kiosk/scan", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kiosk-token": kioskToken,
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
        setError(
          `Offline/failed. Queued for sync. (${scanError instanceof Error ? scanError.message : "error"})`,
        );
      }
    },
    [kioskToken, queueEvent],
  );

  const syncQueue = React.useCallback(async () => {
    if (queue.length === 0 || status !== "online" || !kioskToken) return;

    try {
      const response = await fetch("/api/kiosk/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiosk-token": kioskToken,
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

      const completed = new Set(
        payload.results.filter((item) => item.status !== "error").map((item) => item.clientEventId),
      );

      const latestProcessed = payload.results.find((item) => item.status === "processed" && item.result?.employee);
      if (latestProcessed?.result) {
        setLastResult(latestProcessed.result);
      }

      setQueue((prev) => prev.filter((event) => !completed.has(event.clientEventId)));
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

  function saveSettings() {
    localStorage.setItem(TOKEN_STORAGE_KEY, kioskToken);
    localStorage.setItem(PIN_STORAGE_KEY, pin || "1234");
    setError(null);
  }

  function clearToken() {
    const entered = window.prompt("Enter kiosk PIN to clear token", "");
    if (!entered || entered !== pin) {
      setError("Invalid PIN.");
      return;
    }
    setKioskToken("");
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">HR Kiosk</h1>
      <div className="rounded border p-3 text-sm">
        Status: <strong>{status === "online" ? "Online" : "Offline"}</strong> (Queued: {queue.length})
      </div>

      <section className="space-y-2 rounded border p-3">
        <h2 className="font-medium">Kiosk Settings</h2>
        <input
          className="w-full rounded border p-2"
          placeholder="Kiosk token"
          value={kioskToken}
          onChange={(event) => setKioskToken(event.target.value)}
        />
        <input
          className="w-full rounded border p-2"
          placeholder="PIN"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2" onClick={saveSettings}>
            Save
          </button>
          <button className="rounded border px-3 py-2" onClick={clearToken}>
            Clear token
          </button>
        </div>
      </section>

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
