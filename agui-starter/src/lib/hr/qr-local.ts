import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class EmployeeIdQrGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeIdQrGenerationError";
  }
}

export async function generateQrPngDataUrl(token: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "qrencode",
      ["-o", "-", "-t", "PNG", "-s", "8", "-m", "0", token],
      {
        encoding: "buffer",
        maxBuffer: 1024 * 1024,
      },
    );

    const png = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    if (png.byteLength === 0) {
      throw new Error("QR output is empty");
    }

    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
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
