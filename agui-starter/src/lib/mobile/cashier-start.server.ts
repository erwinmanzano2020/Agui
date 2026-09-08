import "server-only";

import { cookies } from "next/headers";

import type {
  CashierStartContextResponse,
  CashierStartSubmitPayload,
  CashierStartSubmitResponse,
} from "@/lib/mobile/cashier-start";
import {
  DIRECT_STAFF_SESSION_COOKIE,
  DirectStaffSessionConfigError,
  verifyDirectStaffSessionCookie,
} from "@/lib/mobile/direct-session.server";
import { DirectStaffSessionTokenError } from "@/lib/mobile/direct-session-token";
import { validateTelegramInitData } from "@/lib/miniapp/telegram-init-data.server";

export type CashierStartUpstreamAuth =
  | { authMode: "TELEGRAM"; initData: string }
  | {
      authMode: "DIRECT";
      directSession: { sessionId: string; deviceId: string; employeeId: string };
    };

export class CashierStartRouteError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "CashierStartRouteError";
    this.code = code;
    this.status = status;
  }
}

function telegramBotToken() {
  return (
    process.env.TELEGRAM_BOT_TOKEN ??
    process.env.AGUI_TELEGRAM_BOT_TOKEN ??
    process.env.AGUi_TELEGRAM_BOT_TOKEN ??
    ""
  );
}

export async function resolveCashierStartAuth(initData?: string): Promise<CashierStartUpstreamAuth> {
  const telegramInitData = initData?.trim() ?? "";
  if (telegramInitData) {
    const maxAge = Number(process.env.AGUI_MINI_APP_AUTH_MAX_AGE_SECONDS ?? 7200);
    const validation = validateTelegramInitData(
      telegramInitData,
      telegramBotToken(),
      Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 7200,
    );
    if (!validation.ok) {
      throw new CashierStartRouteError(validation.message, validation.code, 401);
    }
    return { authMode: "TELEGRAM", initData: telegramInitData };
  }

  if (process.env.AGUI_MOBILE_DIRECT_AUTH_POC !== "enabled") {
    throw new CashierStartRouteError(
      "Direct Agui staff authentication is not enabled on this preview.",
      "DIRECT_AUTH_NOT_ENABLED",
      503,
    );
  }

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(DIRECT_STAFF_SESSION_COOKIE)?.value ?? "";
  if (!rawCookie) {
    throw new CashierStartRouteError(
      "Sign in to Agui Mobile before opening a cashier shift.",
      "DIRECT_SESSION_MISSING",
      401,
    );
  }

  try {
    const claims = verifyDirectStaffSessionCookie(rawCookie);
    return {
      authMode: "DIRECT",
      directSession: {
        sessionId: claims.sessionId,
        deviceId: claims.deviceId,
        employeeId: claims.employeeId,
      },
    };
  } catch (error) {
    if (error instanceof DirectStaffSessionConfigError) {
      throw new CashierStartRouteError(error.message, error.code, error.status);
    }
    if (error instanceof DirectStaffSessionTokenError) {
      throw new CashierStartRouteError(
        "Direct staff session expired or is invalid. Sign in again.",
        "DIRECT_SESSION_INVALID",
        401,
      );
    }
    throw error;
  }
}

async function callCashierStartUpstream<T>(
  action: "CASHIER_START_CONTEXT" | "CASHIER_START_SUBMIT",
  auth: CashierStartUpstreamAuth,
  payload?: CashierStartSubmitPayload,
): Promise<T> {
  const appsScriptUrl =
    process.env.AGUI_APPS_SCRIPT_WEB_APP_URL ??
    process.env.AGUI_APPS_SCRIPT_API_URL ??
    "";
  const proxySecret =
    process.env.AGUI_MINI_APP_API_SECRET ??
    process.env.AGUI_APPS_SCRIPT_API_SECRET ??
    "";

  if (!appsScriptUrl || !proxySecret) {
    throw new CashierStartRouteError(
      "Agui cashier service is not configured.",
      "SERVER_NOT_CONFIGURED",
      503,
    );
  }

  let response: Response;
  try {
    const url = new URL(appsScriptUrl);
    url.searchParams.set("channel", "miniapp");
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proxySecret, action, ...auth, ...(payload ? { payload } : {}) }),
    });
  } catch {
    throw new CashierStartRouteError(
      "Agui cashier service is temporarily unreachable.",
      "UPSTREAM_UNREACHABLE",
      502,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new CashierStartRouteError(
      "Agui cashier service returned an invalid response.",
      "UPSTREAM_BAD_RESPONSE",
      502,
    );
  }
}

export function cashierStartFailureStatus(code?: string) {
  if (!code) return 409;
  if (code === "UNAUTHORIZED_PROXY") return 502;
  if (code.startsWith("INIT_") || code.startsWith("DIRECT_SESSION_")) return 401;
  if (code === "CASHIER_SHIFT_NOT_ALLOWED" || code === "BRANCH_NOT_AUTHORIZED") return 403;
  if (code === "SERVER_NOT_CONFIGURED" || code === "DIRECT_AUTH_NOT_ENABLED") return 503;
  return 409;
}

export async function loadCashierStartContext(initData?: string) {
  const auth = await resolveCashierStartAuth(initData);
  return callCashierStartUpstream<CashierStartContextResponse>("CASHIER_START_CONTEXT", auth);
}

export async function submitCashierStart(initData: string | undefined, payload: CashierStartSubmitPayload) {
  const auth = await resolveCashierStartAuth(initData);
  return callCashierStartUpstream<CashierStartSubmitResponse>("CASHIER_START_SUBMIT", auth, payload);
}
