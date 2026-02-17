import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  EmployeeIdQrGenerationError,
  generateQrPngDataUrl,
  setQrEncoderLoaderForTest,
} from "@/lib/hr/qr-local";

afterEach(() => {
  setQrEncoderLoaderForTest(null);
});

describe("generateQrPngDataUrl", () => {
  it("returns a PNG data URL", async () => {
    setQrEncoderLoaderForTest(() => ({
      toDataURL: async () => "data:image/png;base64,AAA=",
    }));

    const url = await generateQrPngDataUrl("sample-token");
    assert.match(url, /^data:image\/png;base64,/);
  });

  it("throws EmployeeIdQrGenerationError on generator failure", async () => {
    setQrEncoderLoaderForTest(() => ({
      toDataURL: async () => {
        throw new Error("encoder failed");
      },
    }));

    await assert.rejects(
      () => generateQrPngDataUrl("sample-token"),
      (error: unknown) =>
        error instanceof EmployeeIdQrGenerationError && /Failed to generate QR code: encoder failed/.test(error.message),
    );
  });
});
