import "server-only";

import type { DirectStaffSession } from "@/lib/mobile/direct-auth";
import {
  createDirectStaffSessionToken,
  verifyDirectStaffSessionToken,
  type DirectStaffSessionTokenClaims,
} from "@/lib/mobile/direct-session-token";

export const DIRECT_STAFF_SESSION_COOKIE = "agui_mobile_staff_session";

export class DirectStaffSessionConfigError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "DIRECT_SESSION_NOT_CONFIGURED", status = 503) {
    super(message);
    this.name = "DirectStaffSessionConfigError";
    this.code = code;
    this.status = status;
  }
}

function getSessionSecret() {
  const secret = process.env.AGUI_MOBILE_SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new DirectStaffSessionConfigError("Direct staff-session signing is not configured.");
  }
  return secret;
}

export function directStaffSessionMaxAgeSeconds() {
  const configured = Number(process.env.AGUI_MOBILE_DIRECT_SESSION_SECONDS ?? 43_200);
  if (!Number.isFinite(configured)) return 43_200;
  return Math.min(86_400, Math.max(900, Math.floor(configured)));
}

export function createDirectStaffSessionCookie(session: DirectStaffSession) {
  const maxAge = directStaffSessionMaxAgeSeconds();
  const value = createDirectStaffSessionToken(
    {
      sessionId: session.sessionId,
      deviceId: session.deviceId,
      employeeId: session.employeeId,
      ttlSeconds: maxAge,
    },
    getSessionSecret(),
  );
  return { value, maxAge };
}

export function verifyDirectStaffSessionCookie(value: string): DirectStaffSessionTokenClaims {
  return verifyDirectStaffSessionToken(value, getSessionSecret());
}

export function directStaffSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function expiredDirectStaffSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
