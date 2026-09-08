import { NextResponse } from "next/server";

import type { CashierStartContextResponse } from "@/lib/mobile/cashier-start";
import {
  CashierStartRouteError,
  cashierStartFailureStatus,
  loadCashierStartContext,
} from "@/lib/mobile/cashier-start.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: CashierStartContextResponse, status = 200) {
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

  try {
    const result = await loadCashierStartContext(body.initData);
    if (!result.ok) return json(result, cashierStartFailureStatus(result.code));
    if (result.action !== "CASHIER_START_CONTEXT" || result.mode !== "DUAL_ENTRY_CASHIER_START_POC") {
      return json({ ok: false, code: "UPSTREAM_MODE_MISMATCH", message: "Agui cashier service returned an unsupported start context." }, 502);
    }
    return json(result);
  } catch (error) {
    if (error instanceof CashierStartRouteError) {
      return json({ ok: false, code: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}
