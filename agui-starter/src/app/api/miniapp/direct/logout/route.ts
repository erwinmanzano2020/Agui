import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  DIRECT_AUTH_ACTIONS,
  isDirectAuthFailure,
  parseDirectLogoutSuccess,
  type DirectLogoutResponse,
} from "@/lib/mobile/direct-auth";
import { callDirectAuthUpstream, DirectAuthProxyError } from "@/lib/mobile/direct-proxy.server";
import {
  DIRECT_STAFF_SESSION_COOKIE,
  DirectStaffSessionConfigError,
  expiredDirectStaffSessionCookieOptions,
  verifyDirectStaffSessionCookie,
} from "@/lib/mobile/direct-session.server";
import { DirectStaffSessionTokenError } from "@/lib/mobile/direct-session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: DirectLogoutResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function clearCookie(response: NextResponse) {
  response.cookies.set(DIRECT_STAFF_SESSION_COOKIE, "", expiredDirectStaffSessionCookieOptions());
  return response;
}

export async function POST() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(DIRECT_STAFF_SESSION_COOKIE)?.value ?? "";
  if (!rawCookie) {
    return json({ ok: false, code: "DIRECT_SESSION_MISSING", message: "No direct staff session is active." }, 401);
  }

  let claims;
  try {
    claims = verifyDirectStaffSessionCookie(rawCookie);
  } catch (error) {
    if (error instanceof DirectStaffSessionTokenError || error instanceof DirectStaffSessionConfigError) {
      return clearCookie(json({ ok: false, code: "DIRECT_SESSION_INVALID", message: "This browser session was cleared." }, 401));
    }
    throw error;
  }

  try {
    const upstream = await callDirectAuthUpstream(DIRECT_AUTH_ACTIONS.logout, {
      sessionId: claims.sessionId,
      deviceId: claims.deviceId,
      employeeId: claims.employeeId,
    });
    const success = parseDirectLogoutSuccess(upstream, claims.sessionId);
    if (success) return clearCookie(json(success));
    if (isDirectAuthFailure(upstream)) {
      return clearCookie(json({ ok: false, code: "DIRECT_LOGOUT_NOT_CONFIRMED", message: "Signed out of this browser, but Agui could not confirm the shared-device session closed." }, 409));
    }
    return clearCookie(json({ ok: false, code: "DIRECT_AUTH_CONTRACT_MISMATCH", message: "Signed out of this browser, but Agui returned an unsupported logout response." }, 502));
  } catch (error) {
    if (error instanceof DirectAuthProxyError) {
      return clearCookie(json({ ok: false, code: error.code, message: "Signed out of this browser. Upstream session closure was not confirmed." }, error.status));
    }
    throw error;
  }
}
