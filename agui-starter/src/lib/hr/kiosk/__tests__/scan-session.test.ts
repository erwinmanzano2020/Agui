import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  shouldSubmitKeyboardWedge,
  stopStreamTracks,
  transitionCameraState,
} from "@/lib/hr/kiosk/scan-session";

describe("kiosk scan session", () => {
  it("supports camera state transitions starting -> scanning -> idle", () => {
    const starting = transitionCameraState("idle", "start");
    const scanning = transitionCameraState(starting, "ready");
    const idle = transitionCameraState(scanning, "stop");

    assert.equal(starting, "starting");
    assert.equal(scanning, "scanning");
    assert.equal(idle, "idle");
  });

  it("stopStreamTracks stops all tracks", () => {
    let stopped = 0;
    const stream = {
      getTracks() {
        return [
          { stop: () => void (stopped += 1) },
          { stop: () => void (stopped += 1) },
        ];
      },
    } as unknown as MediaStream;

    const count = stopStreamTracks(stream);
    assert.equal(count, 2);
    assert.equal(stopped, 2);
  });

  it("keyboard wedge submits only on enter with non-empty value", () => {
    assert.equal(shouldSubmitKeyboardWedge("Enter", "abc"), true);
    assert.equal(shouldSubmitKeyboardWedge("Enter", "   "), false);
    assert.equal(shouldSubmitKeyboardWedge("Space", "abc"), false);
  });
});
