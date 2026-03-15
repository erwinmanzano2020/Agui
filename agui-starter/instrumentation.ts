export async function register(): Promise<void> {
  const proc = globalThis.process as
    | (NodeJS.Process & { on?: NodeJS.Process["on"] })
    | undefined;

  proc?.on?.("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });

  proc?.on?.("uncaughtException", (error) => {
    console.error("[uncaughtException]", error);
  });

  if (typeof globalThis.addEventListener === "function") {
    globalThis.addEventListener("unhandledrejection", (event) => {
      console.error("[globalThis.unhandledrejection]", event.reason);
    });

    globalThis.addEventListener("error", (event) => {
      console.error("[globalThis.error]", event.error ?? event.message);
    });
  }
}
