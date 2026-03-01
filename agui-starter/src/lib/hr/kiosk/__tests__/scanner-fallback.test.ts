import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getScannerStrategy, runScanActionSafely } from "@/lib/hr/kiosk/scanner-fallback";

describe("kiosk scanner fallback", () => {
  it("selects jsqr fallback when BarcodeDetector is unavailable", () => {
    assert.equal(getScannerStrategy(false), "jsqr_fallback");
    assert.equal(getScannerStrategy(true), "barcode_detector");
  });

  it("runScanActionSafely does not throw and does not mutate location", async () => {
    const currentLocation = "http://localhost/company/test/kiosk";
    let location = currentLocation;

    await runScanActionSafely(async () => {
      location = currentLocation;
      throw new Error("scanner failed");
    });

    assert.equal(location, currentLocation);
  });
});
