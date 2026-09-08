import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  DIRECT_AUTH_ACTIONS,
  isDirectAuthFailure,
  parseDirectSessionSuccess,
  type DirectSessionResponse,
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

function json(body: DirectSessionResponse, status = 200) {
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
    if (error instanceof DirectStaffSessionTokenError) {
      return clearCookie(json({ ok: false, code: "DIRECT_SESSION_INVALID", message: "Direct staff session expired or is invalid." }, 401));
    }
    if (error instanceof DirectStaffSessionConfigError) {
      return clearCookie(json({ ok: false, code: error.code, message: error.message }, error.status));
    }
    throw error;
  }

  try {
    const upstream = await callDirectAuthUpstream(DIRECT_AUTH_ACTIONS.session, {
      sessionId: claims.sessionId,
      deviceId: claims.deviceId,
      employeeId: claims.employeeId,
    });
    const success = parseDirectSessionSuccess(upstream, claims);
    if (success) return json(success);
    if (isDirectAuthFailure(upstream)) {
      return clearCookie(json({ ok: false, code: "DIRECT_SESSION_INACTIVE", message: "Direct staff session is no longer active." }, 401));
    }
    return clearCookie(json({ ok: false, code: "DIRECT_AUTH_CONTRACT_MISMATCH", message: "Agui direct sign-in returned an unsupported session response." }, 502));
  } catch (error) {
    if (error instanceof DirectAuthProxyError) {
      return json({ ok: false, code: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}
