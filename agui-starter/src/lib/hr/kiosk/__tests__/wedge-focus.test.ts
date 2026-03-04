import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldAutoFocusWedge, shouldCaptureWedgeInput } from "@/lib/hr/kiosk/wedge-focus";

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


describe("wedge capture helper", () => {
  it("does not capture while settings modal is open", () => {
    assert.equal(
      shouldCaptureWedgeInput({
        kioskMode: "ready",
        settingsOpen: true,
        setupOpen: false,
        setupStep: "welcome",
      }),
      false,
    );
  });

  it("captures again after settings modal closes in ready mode", () => {
    assert.equal(
      shouldCaptureWedgeInput({
        kioskMode: "ready",
        settingsOpen: false,
        setupOpen: false,
        setupStep: "welcome",
      }),
      true,
    );
  });
});
