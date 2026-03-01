import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CAMERA_FACING_MODE_STORAGE_KEY,
  cleanupScanSession,
  loadFacingModePreference,
  persistFacingModePreference,
  shouldSubmitKeyboardWedge,
  stopStreamTracks,
  toggleFacingMode,
  transitionCameraState,
  transitionKioskMode,
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

  it("supports kiosk mode transitions idle -> scanning -> success -> scanning -> idle", () => {
    const scanning = transitionKioskMode("idle", "tap");
    const success = transitionKioskMode(scanning, "decoded");
    const burst = transitionKioskMode(success, "burst");
    const idle = transitionKioskMode(burst, "idle_timeout");

    assert.equal(scanning, "scanning");
    assert.equal(success, "success");
    assert.equal(burst, "scanning");
    assert.equal(idle, "idle");
  });

  it("loads user-facing camera by default and respects persisted preference", () => {
    const storage = {
      getItem(key: string) {
        if (key === CAMERA_FACING_MODE_STORAGE_KEY) return "environment";
        return null;
      },
    };

    assert.equal(loadFacingModePreference(undefined), "user");
    assert.equal(loadFacingModePreference(storage), "environment");
  });

  it("toggles and persists camera preference", () => {
    const writes: Array<[string, string]> = [];
    const storage = {
      setItem(key: string, value: string) {
        writes.push([key, value]);
      },
    };

    const next = toggleFacingMode("user");
    persistFacingModePreference(storage, next);

    assert.equal(next, "environment");
    assert.deepEqual(writes, [[CAMERA_FACING_MODE_STORAGE_KEY, "environment"]]);
  });


  it("cleanupScanSession cancels RAF, clears timeouts, and stops stream tracks", () => {
    let stopped = 0;
    let paused = 0;
    let rafCancelled = 0;
    let timeoutsCleared = 0;

    const stream = {
      getTracks() {
        return [{ stop: () => void (stopped += 1) }];
      },
    } as unknown as MediaStream;

    const video = {
      pause: () => void (paused += 1),
      srcObject: stream,
    } as unknown as HTMLVideoElement;

    const browserWindow = globalThis as typeof globalThis & {
      cancelAnimationFrame: (id: number) => void;
      clearTimeout: (id: number) => void;
    };
    const originalCancelAnimationFrame = browserWindow.cancelAnimationFrame;
    const originalClearTimeout = browserWindow.clearTimeout;

    browserWindow.cancelAnimationFrame = () => {
      rafCancelled += 1;
    };
    browserWindow.clearTimeout = () => {
      timeoutsCleared += 1;
    };

    const cleaned = cleanupScanSession({
      rafId: 10,
      timeoutIds: [12, 13, null],
      stream,
      video,
    });

    browserWindow.cancelAnimationFrame = originalCancelAnimationFrame;
    browserWindow.clearTimeout = originalClearTimeout;

    assert.equal(cleaned.cancelledRaf, true);
    assert.equal(cleaned.clearedTimeouts, 2);
    assert.equal(cleaned.stoppedTracks, 1);
    assert.equal(rafCancelled, 1);
    assert.equal(timeoutsCleared, 2);
    assert.equal(stopped, 1);
    assert.equal(paused, 1);
    assert.equal(video.srcObject, null);
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
