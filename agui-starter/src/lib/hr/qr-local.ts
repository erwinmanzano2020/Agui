import "server-only";
import QRCode from "qrcode";

export class EmployeeIdQrGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeIdQrGenerationError";
  }
}

type QrEncoder = {
  toDataURL: (
    text: string,
    options?: {
      errorCorrectionLevel?: "L" | "M" | "Q" | "H";
      margin?: number;
      width?: number;
      type?: string;
    },
  ) => Promise<string>;
};

let qrEncoder: QrEncoder = QRCode;

export async function generateQrPngDataUrl(token: string): Promise<string> {
  try {
    const dataUrl = await qrEncoder.toDataURL(token, {
      type: "image/png",
      errorCorrectionLevel: "M",
      margin: 0,
      width: 256,
    });

    if (!dataUrl.startsWith("data:image/png;base64,")) {
      throw new Error("Unexpected QR output format");
    }

    return dataUrl;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const tokenPrefix = token.slice(0, 8);
    console.error("[hr][qr-local] Failed to generate QR code", {
      reason,
      stack,
      tokenPrefix,
    });
    throw new EmployeeIdQrGenerationError(`Failed to generate QR code: ${reason}`);
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => runWorker()));
  return results;
}

export function setQrEncoderLoaderForTest(loader: (() => QrEncoder | Promise<QrEncoder>) | null): void {
  if (!loader) {
    qrEncoder = QRCode;
    return;
  }

  qrEncoder = {
    toDataURL: async (text, options) => {
      const encoder = await loader();
      return encoder.toDataURL(text, options);
    },
  };
}
