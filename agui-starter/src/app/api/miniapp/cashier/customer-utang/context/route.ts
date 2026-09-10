import { NextResponse } from "next/server";

import {
  isCustomerUtangContextSuccess,
  type CustomerUtangContextResponse,
} from "@/lib/mobile/customer-utang";
import {
  CustomerUtangRouteError,
  customerUtangFailureStatus,
  loadCustomerUtangContext,
} from "@/lib/mobile/customer-utang.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: CustomerUtangContextResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  let body: { initData?: string };
  try {
    body = (await request.json()) as { initData?: string };
  } catch {
    return json({ ok: false, code: "BAD_JSON", message: "Invalid request body." }, 400);
  }

  try {
    const result = await loadCustomerUtangContext(body.initData);
    if (!result.ok) return json(result, customerUtangFailureStatus(result.code));
    if (!isCustomerUtangContextSuccess(result)) {
      return json({
        ok: false,
        code: "UPSTREAM_CONTEXT_MISMATCH",
        message: "Agui Customer Utang returned an unsupported or unsafe context.",
      }, 502);
    }
    return json(result);
  } catch (error) {
    if (error instanceof CustomerUtangRouteError) {
      return json({ ok: false, code: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}
