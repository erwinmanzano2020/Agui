import { NextResponse } from "next/server";

import {
  DIRECT_AUTH_ACTIONS,
  isDirectAuthFailure,
  normalizeDirectDeviceId,
  normalizeDirectEmployeeId,
  normalizeDirectStaffPin,
  parseDirectLoginSuccess,
  type DirectLoginResponse,
} from "@/lib/mobile/direct-auth";
import { callDirectAuthUpstream, DirectAuthProxyError } from "@/lib/mobile/direct-proxy.server";
import {
  createDirectStaffSessionCookie,
  DIRECT_STAFF_SESSION_COOKIE,
  directStaffSessionCookieOptions,
  DirectStaffSessionConfigError,
} from "@/lib/mobile/direct-session.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: DirectLoginResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  let body: { deviceId?: string; employeeId?: string; pin?: string };
  try {
    body = (await request.json()) as { deviceId?: string; employeeId?: string; pin?: string };
  } catch {
    return json({ ok: false, code: "BAD_JSON", message: "Invalid request body." }, 400);
  }

  const deviceId = normalizeDirectDeviceId(body.deviceId);
  const employeeId = normalizeDirectEmployeeId(body.employeeId);
  const pin = normalizeDirectStaffPin(body.pin);
  if (!deviceId || !employeeId || !pin) {
    return json({ ok: false, code: "DIRECT_CREDENTIAL_FORMAT_INVALID", message: "Check the Device ID, Employee ID, and Staff PIN." }, 400);
  }

  try {
    const upstream = await callDirectAuthUpstream(DIRECT_AUTH_ACTIONS.login, { deviceId, employeeId, pin });
    const success = parseDirectLoginSuccess(upstream, { deviceId, employeeId });
    if (!success) {
      if (isDirectAuthFailure(upstream)) {
        return json({ ok: false, code: "INVALID_STAFF_SIGN_IN", message: "Invalid staff sign-in." }, 403);
      }
      return json({ ok: false, code: "DIRECT_AUTH_CONTRACT_MISMATCH", message: "Agui direct sign-in returned an unsupported session response." }, 502);
    }

    const cookie = createDirectStaffSessionCookie(success.session);
    const response = json(success);
    response.cookies.set(DIRECT_STAFF_SESSION_COOKIE, cookie.value, directStaffSessionCookieOptions(cookie.maxAge));
    return response;
  } catch (error) {
    if (error instanceof DirectAuthProxyError || error instanceof DirectStaffSessionConfigError) {
      return json({ ok: false, code: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}
