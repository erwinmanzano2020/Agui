import crypto from "node:crypto";

export function hashKioskToken(token: string): string {
  const pepper = process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER ?? "";
  return crypto.createHash("sha256").update(`${pepper}:${token}`, "utf8").digest("hex");
}

export function createKioskDeviceToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
