import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldAutoFocusWedge } from "@/lib/hr/kiosk/wedge-focus";

describe("wedge focus helper", () => {
  it("does not refocus while settingsOpen is true", () => {
    assert.equal(
      shouldAutoFocusWedge({
        kioskMode: "ready",
        settingsOpen: true,
        setupOpen: false,
        setupStep: "welcome",
      }),
      false,
    );
  });

  it("refocuses when settings close while kiosk is ready", () => {
    assert.equal(
      shouldAutoFocusWedge({
        kioskMode: "ready",
        settingsOpen: false,
        setupOpen: false,
        setupStep: "welcome",
      }),
      true,
    );
  });

  it("does not refocus during setup typing steps", () => {
    assert.equal(
      shouldAutoFocusWedge({
        kioskMode: "ready",
        settingsOpen: false,
        setupOpen: true,
        setupStep: "token",
      }),
      false,
    );
    assert.equal(
      shouldAutoFocusWedge({
        kioskMode: "ready",
        settingsOpen: false,
        setupOpen: true,
        setupStep: "confirm",
      }),
      false,
    );
  });
});
