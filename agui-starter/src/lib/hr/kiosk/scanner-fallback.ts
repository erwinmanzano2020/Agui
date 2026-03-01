export type ScannerStrategy = "barcode_detector" | "jsqr_fallback";

export type JsQrDecodeResult = { data?: string } | null;
export type JsQrDecoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "attemptBoth" | "onlyInvert" | "invertFirst" },
) => JsQrDecodeResult;

type WindowWithJsQr = Window & { jsQR?: JsQrDecoder };

const JSQR_CDN_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

export function getScannerStrategy(hasBarcodeDetector: boolean): ScannerStrategy {
  return hasBarcodeDetector ? "barcode_detector" : "jsqr_fallback";
}

export async function runScanActionSafely(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // swallow to keep kiosk in-page and prevent unhandled navigation side effects
  }
}

export async function loadJsQrDecoder(doc: Document): Promise<JsQrDecoder> {
  const win = doc.defaultView as WindowWithJsQr | null;
  if (win?.jsQR) return win.jsQR;

  await new Promise<void>((resolve, reject) => {
    const existing = doc.querySelector<HTMLScriptElement>('script[data-kiosk-jsqr="1"]');
    if (existing) {
      if ((existing as HTMLScriptElement).dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load jsQR decoder.")), { once: true });
      return;
    }

    const script = doc.createElement("script");
    script.src = JSQR_CDN_URL;
    script.async = true;
    script.dataset.kioskJsqr = "1";
    script.addEventListener("load", () => {
      script.dataset.loaded = "1";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error("Failed to load jsQR decoder.")), { once: true });
    doc.head.appendChild(script);
  });

  const loaded = (doc.defaultView as WindowWithJsQr | null)?.jsQR;
  if (!loaded) throw new Error("jsQR decoder unavailable after load.");
  return loaded;
}
