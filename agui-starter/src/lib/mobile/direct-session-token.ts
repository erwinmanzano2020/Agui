import crypto from "node:crypto";

export type DirectStaffSessionTokenClaims = {
  sessionId: string;
  deviceId: string;
  employeeId: string;
  iat: number;
  exp: number;
};

export class DirectStaffSessionTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectStaffSessionTokenError";
  }
}

function assertSecret(secret: string) {
  if (secret.length < 32) {
    throw new DirectStaffSessionTokenError("Direct staff-session secret must be at least 32 characters.");
  }
}

function sign(encodedPayload: string, secret: string) {
  assertSecret(secret);
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createDirectStaffSessionToken(
  input: { sessionId: string; deviceId: string; employeeId: string; ttlSeconds: number },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!input.sessionId || !input.deviceId || !input.employeeId) {
    throw new DirectStaffSessionTokenError("Direct staff-session token is missing identity claims.");
  }
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds <= 0) {
    throw new DirectStaffSessionTokenError("Direct staff-session token TTL is invalid.");
  }

  const payload: DirectStaffSessionTokenClaims = {
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    employeeId: input.employeeId,
    iat: nowSeconds,
    exp: nowSeconds + input.ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `v1.${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyDirectStaffSessionToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): DirectStaffSessionTokenClaims {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new DirectStaffSessionTokenError("Invalid direct staff-session token format.");
  }

  const encodedPayload = parts[1];
  const signature = parts[2];
  const expected = sign(encodedPayload, secret);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (signatureBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(signatureBytes, expectedBytes)) {
    throw new DirectStaffSessionTokenError("Invalid direct staff-session token signature.");
  }

  let payload: DirectStaffSessionTokenClaims;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as DirectStaffSessionTokenClaims;
  } catch {
    throw new DirectStaffSessionTokenError("Malformed direct staff-session token payload.");
  }

  if (
    !payload.sessionId ||
    !payload.deviceId ||
    !payload.employeeId ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= payload.iat
  ) {
    throw new DirectStaffSessionTokenError("Direct staff-session token claims are invalid.");
  }
  if (nowSeconds > payload.exp) {
    throw new DirectStaffSessionTokenError("Direct staff-session token has expired.");
  }

  return payload;
}
