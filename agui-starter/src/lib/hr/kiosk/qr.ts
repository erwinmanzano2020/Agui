import crypto from "node:crypto";

type EmployeeQrPayload = {
  employee_id: string;
  house_id: string;
  iat: number;
  exp?: number;
};

export class EmployeeQrTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeQrTokenError";
  }
}

function getQrSecret(): string {
  const secret = process.env.HR_KIOSK_QR_SECRET;
  if (!secret) {
    throw new EmployeeQrTokenError("HR_KIOSK_QR_SECRET is not configured.");
  }
  return secret;
}

function signPayload(payloadBase64: string): string {
  return crypto.createHmac("sha256", getQrSecret()).update(payloadBase64).digest("base64url");
}

export function createEmployeeQrToken(input: {
  employeeId: string;
  houseId: string;
  expiresAt?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: EmployeeQrPayload = {
    employee_id: input.employeeId,
    house_id: input.houseId,
    iat: now,
  };

  if (input.expiresAt) {
    const exp = Math.floor(new Date(input.expiresAt).getTime() / 1000);
    if (!Number.isFinite(exp)) {
      throw new EmployeeQrTokenError("Invalid QR token expiration timestamp.");
    }
    payload.exp = exp;
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);
  return `v1.${encodedPayload}.${signature}`;
}

export function verifyEmployeeQrToken(token: string): { employeeId: string; houseId: string } {
  const trimmed = token.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new EmployeeQrTokenError("Invalid QR token format.");
  }

  const [_, encodedPayload, signature] = parts;
  const expected = signPayload(encodedPayload);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    signatureBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    throw new EmployeeQrTokenError("Invalid QR token signature.");
  }

  let payload: EmployeeQrPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as EmployeeQrPayload;
  } catch {
    throw new EmployeeQrTokenError("Malformed QR token payload.");
  }

  if (!payload.employee_id || !payload.house_id) {
    throw new EmployeeQrTokenError("QR token payload is missing required claims.");
  }

  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new EmployeeQrTokenError("QR token has expired.");
  }

  return {
    employeeId: payload.employee_id,
    houseId: payload.house_id,
  };
}
