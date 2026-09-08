import { NextResponse } from "next/server";

import type { CashierStartSubmitPayload, CashierStartSubmitResponse } from "@/lib/mobile/cashier-start";
import {
  CashierStartRouteError,
  cashierStartFailureStatus,
  submitCashierStart,
} from "@/lib/mobile/cashier-start.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: CashierStartSubmitResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  let body: { initData?: string; payload?: CashierStartSubmitPayload };
  try {
    body = (await request.json()) as { initData?: string; payload?: CashierStartSubmitPayload };
  } catch {
    return json({ ok: false, code: "BAD_JSON", message: "Invalid request body." }, 400);
  }

  if (!body.payload) {
    return json({ ok: false, code: "PAYLOAD_MISSING", message: "Cashier start payload is missing." }, 400);
  }

  try {
    const result = await submitCashierStart(body.initData, body.payload);
    if (!result.ok) return json(result, cashierStartFailureStatus(result.code));
    if (result.action !== "CASHIER_START_SUBMIT" || result.mode !== "DUAL_ENTRY_CASHIER_START_POC") {
      return json({ ok: false, code: "UPSTREAM_MODE_MISMATCH", message: "Agui cashier service returned an unsupported start result." }, 502);
    }
    return json(result);
  } catch (error) {
    if (error instanceof CashierStartRouteError) {
      return json({ ok: false, code: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}
