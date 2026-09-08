import type { AguiMobileLaunchMode } from "@/lib/mobile/workspace";

export type TelegramWebAppLike = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
};

type WindowWithTelegram = Window & {
  Telegram?: {
    WebApp?: TelegramWebAppLike;
  };
};

export type AguiMobileEntry = {
  launchMode: AguiMobileLaunchMode;
  telegramInitData: string;
  telegramWebApp: TelegramWebAppLike | null;
  directAuthReady: false;
};

export function launchModeFromTelegramInitData(initData?: string | null): AguiMobileLaunchMode {
  return initData?.trim() ? "telegram" : "direct";
}

export function readTelegramWebApp(source: Window): TelegramWebAppLike | undefined {
  return (source as WindowWithTelegram).Telegram?.WebApp;
}

export async function resolveAguiMobileEntry(
  source: Window,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<AguiMobileEntry> {
  const attempts = Math.max(1, options.attempts ?? 20);
  const delayMs = Math.max(0, options.delayMs ?? 40);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const webApp = readTelegramWebApp(source);
    if (webApp) {
      webApp.ready?.();
      webApp.expand?.();
      const telegramInitData = webApp.initData?.trim() ?? "";
      return {
        launchMode: launchModeFromTelegramInitData(telegramInitData),
        telegramInitData,
        telegramWebApp: webApp,
        directAuthReady: false,
      };
    }

    if (attempt < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => source.setTimeout(resolve, delayMs));
    }
  }

  return {
    launchMode: "direct",
    telegramInitData: "",
    telegramWebApp: null,
    directAuthReady: false,
  };
}
