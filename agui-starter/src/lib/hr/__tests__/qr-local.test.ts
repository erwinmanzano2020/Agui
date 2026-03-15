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
    assert.ok(url.startsWith("data:image/png;base64,"));
  });


  it("loads QR encoder through runtime import by default", async () => {
    const url = await generateQrPngDataUrl("sample-token-default-loader");
    assert.ok(url.startsWith("data:image/png;base64,"));
  });

  it("throws when QR encoder returns non-PNG data URL prefix", async () => {
    setQrEncoderLoaderForTest(() => ({
      toDataURL: async () => "data:image/jpeg;base64,AAA=",
    }));

    await assert.rejects(
      () => generateQrPngDataUrl("sample-token"),
      (error: unknown) =>
        error instanceof EmployeeIdQrGenerationError && /Unexpected QR output format/.test(error.message),
    );
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
