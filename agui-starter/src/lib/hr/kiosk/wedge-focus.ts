export type KioskMode = "setup" | "ready" | "sleep" | "flash_result";
export type SetupStep = "welcome" | "token" | "verify" | "confirm" | "harden";

export function isSetupTypingStep(step: SetupStep): boolean {
  return step === "token" || step === "confirm";
}

export function shouldAutoFocusWedge(input: {
  kioskMode: KioskMode;
  settingsOpen: boolean;
  setupOpen: boolean;
  setupStep: SetupStep;
}): boolean {
  const { kioskMode, settingsOpen, setupOpen, setupStep } = input;
  if (kioskMode !== "ready") return false;
  if (settingsOpen) return false;
  if (setupOpen && isSetupTypingStep(setupStep)) return false;
  if (setupOpen) return false;
  return true;
}
