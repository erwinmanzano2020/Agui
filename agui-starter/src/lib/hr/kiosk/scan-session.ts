export type CameraState = "idle" | "starting" | "scanning" | "permission_denied" | "error";
export type CameraEvent = "start" | "ready" | "stop" | "deny" | "fail";

export function transitionCameraState(current: CameraState, event: CameraEvent): CameraState {
  if (event === "start") return "starting";
  if (event === "ready") return "scanning";
  if (event === "stop") return "idle";
  if (event === "deny") return "permission_denied";
  if (event === "fail") return "error";
  return current;
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
