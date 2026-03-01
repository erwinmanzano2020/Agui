export type CameraState = "idle" | "starting" | "scanning" | "permission_denied" | "error";
export type CameraEvent = "start" | "ready" | "stop" | "deny" | "fail";

export type KioskMode = "setup" | "idle" | "scanning" | "success" | "error";
export type KioskModeEvent = "setup_required" | "ready" | "tap" | "decoded" | "burst" | "idle_timeout" | "scan_error" | "reset";

export type FacingMode = "user" | "environment";

export const CAMERA_FACING_MODE_STORAGE_KEY = "hr-kiosk-facing-mode";

export function transitionCameraState(current: CameraState, event: CameraEvent): CameraState {
  if (event === "start") return "starting";
  if (event === "ready") return "scanning";
  if (event === "stop") return "idle";
  if (event === "deny") return "permission_denied";
  if (event === "fail") return "error";
  return current;
}

export function transitionKioskMode(current: KioskMode, event: KioskModeEvent): KioskMode {
  if (event === "setup_required") return "setup";
  if (event === "ready") return "idle";
  if (event === "tap") return "scanning";
  if (event === "decoded") return "success";
  if (event === "burst") return "scanning";
  if (event === "idle_timeout") return "idle";
  if (event === "scan_error") return "error";
  if (event === "reset") return "idle";
  return current;
}

export function loadFacingModePreference(storage: Pick<Storage, "getItem"> | null | undefined): FacingMode {
  const persisted = storage?.getItem(CAMERA_FACING_MODE_STORAGE_KEY);
  if (persisted === "environment") return "environment";
  return "user";
}

export function persistFacingModePreference(
  storage: Pick<Storage, "setItem"> | null | undefined,
  facingMode: FacingMode,
): void {
  storage?.setItem(CAMERA_FACING_MODE_STORAGE_KEY, facingMode);
}

export function toggleFacingMode(facingMode: FacingMode): FacingMode {
  return facingMode === "user" ? "environment" : "user";
}

export function stopStreamTracks(stream: MediaStream | null | undefined): number {
  if (!stream) return 0;
  const tracks = stream.getTracks();
  tracks.forEach((track) => track.stop());
  return tracks.length;
}

export function shouldSubmitKeyboardWedge(key: string, value: string): boolean {
  return key === "Enter" && value.trim().length > 0;
}

export function cleanupScanSession(options: {
  rafId: number | null;
  timeoutIds: Array<number | null>;
  stream: MediaStream | null | undefined;
  video: HTMLVideoElement | null | undefined;
}): { cancelledRaf: boolean; clearedTimeouts: number; stoppedTracks: number } {
  const { rafId, timeoutIds, stream, video } = options;
  let clearedTimeouts = 0;

  const browserWindow = typeof window !== "undefined" ? window : globalThis;

  if (rafId) {
    browserWindow.cancelAnimationFrame(rafId);
  }

  timeoutIds.forEach((timeoutId) => {
    if (timeoutId) {
      browserWindow.clearTimeout(timeoutId);
      clearedTimeouts += 1;
    }
  });

  const stoppedTracks = stopStreamTracks(stream);

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  return {
    cancelledRaf: rafId !== null,
    clearedTimeouts,
    stoppedTracks,
  };
}
