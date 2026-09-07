import { NextResponse } from "next/server";

import { validateTelegramInitData } from "@/lib/miniapp/telegram-init-data.server";
import type { MiniAppClosingLoadResponse } from "@/lib/miniapp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_LOAD_MODE = "LOAD_ONLY_NO_OPERATIONAL_WRITES" as const;

function json(body: MiniAppClosingLoadResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  let body: { initData?: string };
  try {
    body = (await request.json()) as { initData?: string };
  } catch {
    return json({ ok: false, code: "BAD_JSON", message: "Invalid request body." }, 400);
  }

  const initData = typeof body.initData === "string" ? body.initData : "";
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN ??
    process.env.AGUI_TELEGRAM_BOT_TOKEN ??
    process.env.AGUi_TELEGRAM_BOT_TOKEN ??
    "";
  const maxAge = Number(process.env.AGUI_MINI_APP_AUTH_MAX_AGE_SECONDS ?? 7200);
  const validation = validateTelegramInitData(initData, botToken, Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 7200);
  if (!validation.ok) return json(validation, 401);

  // Accept both the pilot's original names and the API_* names already used in Vercel setup.
  const appsScriptUrl =
    process.env.AGUI_APPS_SCRIPT_WEB_APP_URL ??
    process.env.AGUI_APPS_SCRIPT_API_URL ??
    "";
  const proxySecret =
    process.env.AGUI_MINI_APP_API_SECRET ??
    process.env.AGUI_APPS_SCRIPT_API_SECRET ??
    "";

  if (!appsScriptUrl || !proxySecret) {
    return json({ ok: false, code: "SERVER_NOT_CONFIGURED", message: "Agui Mini App server connection is not configured." }, 503);
  }

  let upstream: Response;
  try {
    const url = new URL(appsScriptUrl);
    url.searchParams.set("channel", "miniapp");
    upstream = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proxySecret,
        action: "CASHIER_CLOSE_LOAD",
        initData,
      }),
    });
  } catch {
    return json({ ok: false, code: "UPSTREAM_UNREACHABLE", message: "Agui closing service is temporarily unreachable." }, 502);
  }

  let payload: MiniAppClosingLoadResponse;
  try {
    payload = (await upstream.json()) as MiniAppClosingLoadResponse;
  } catch {
    return json({ ok: false, code: "UPSTREAM_BAD_RESPONSE", message: "Agui closing service returned an invalid response." }, 502);
  }

  if (!payload.ok) {
    const status = payload.code === "UNAUTHORIZED_PROXY" ? 502 : payload.code?.startsWith("INIT_") ? 401 : 409;
    return json(payload, status);
  }

  // Pilot safety gate: never accept a write-enabled/unknown Apps Script contract here.
  if (payload.mode !== EXPECTED_LOAD_MODE || payload.rules.submitEnabled !== false) {
    return json(
      {
        ok: false,
        code: "UPSTREAM_MODE_MISMATCH",
        message: "Agui closing service is not running the approved LOAD-only Mini App contract.",
      },
      502,
    );
  }

  return json(payload);
}
