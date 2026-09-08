import { NextResponse } from "next/server";

import {
  DIRECT_AUTH_ACTIONS,
  isDirectAuthFailure,
  normalizeDirectDeviceId,
  parseDirectDeviceContextSuccess,
  type DirectDeviceContextResponse,
} from "@/lib/mobile/direct-auth";
import { callDirectAuthUpstream, DirectAuthProxyError } from "@/lib/mobile/direct-proxy.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: DirectDeviceContextResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  let body: { deviceId?: string };
  try {
    body = (await request.json()) as { deviceId?: string };
  } catch {
    return json({ ok: false, code: "BAD_JSON", message: "Invalid request body." }, 400);
  }

  const deviceId = normalizeDirectDeviceId(body.deviceId);
  if (!deviceId) {
    return json({ ok: false, code: "DEVICE_ID_INVALID", message: "Enter a valid Agui Device ID." }, 400);
  }

  try {
    const upstream = await callDirectAuthUpstream(DIRECT_AUTH_ACTIONS.context, { deviceId });
    const success = parseDirectDeviceContextSuccess(upstream, deviceId);
    if (success) return json(success);
    if (isDirectAuthFailure(upstream)) {
      return json({ ok: false, code: "DEVICE_NOT_AUTHORIZED", message: "This device is not authorized for direct staff sign-in." }, 403);
    }
    return json({ ok: false, code: "DIRECT_AUTH_CONTRACT_MISMATCH", message: "Agui direct sign-in returned an unsupported device response." }, 502);
  } catch (error) {
    if (error instanceof DirectAuthProxyError) {
      return json({ ok: false, code: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}
