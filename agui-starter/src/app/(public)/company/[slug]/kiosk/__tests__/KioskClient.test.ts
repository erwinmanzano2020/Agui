import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveConnectedLabel } from "@/lib/hr/kiosk/connected-label";

describe("resolveConnectedLabel", () => {
  it("renders branch_name and device name when verified device exists", () => {
    const label = resolveConnectedLabel({
      id: "device-1",
      name: "AndroidMain test #1",
      branch_id: "branch-1",
      branch_name: "Main Branch",
    });

    assert.equal(label, "Connected to: Main Branch • AndroidMain test #1");
  });

  it("falls back to branch_id when branch_name is missing", () => {
    const label = resolveConnectedLabel({
      id: "device-1",
      name: "Kiosk Tablet",
      branch_id: "branch-77",
      branch_name: null,
    });

    assert.equal(label, "Connected to: branch-77 • Kiosk Tablet");
  });

  it("returns null when device is not verified", () => {
    assert.equal(resolveConnectedLabel(null), null);
  });
});
