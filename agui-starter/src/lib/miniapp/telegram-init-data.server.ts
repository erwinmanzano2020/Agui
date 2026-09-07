import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramInitDataValidation =
  | { ok: true; telegramUserId: string; authDate: number }
  | { ok: false; code: string; message: string };

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const values = new Map<string, string>();
  params.forEach((value, key) => values.set(key, value));
  return values;
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 7200,
): TelegramInitDataValidation {
  if (!initData) return { ok: false, code: "INIT_DATA_MISSING", message: "Telegram session data is missing." };
  if (!botToken) return { ok: false, code: "BOT_TOKEN_MISSING", message: "Telegram authentication is not configured." };

  const fields = parseInitData(initData);
  const receivedHash = (fields.get("hash") ?? "").toLowerCase();
  if (!receivedHash) return { ok: false, code: "INIT_HASH_MISSING", message: "Telegram session hash is missing." };

  const dataCheckString = [...fields.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();

  let received: Buffer;
  try {
    received = Buffer.from(receivedHash, "hex");
  } catch {
    return { ok: false, code: "INIT_HASH_INVALID", message: "Telegram session validation failed." };
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, code: "INIT_HASH_INVALID", message: "Telegram session validation failed." };
  }

  const authDate = Number(fields.get("auth_date") ?? 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, code: "INIT_DATA_EXPIRED", message: "This Mini App session expired. Close it and open End Shift again." };
  }

  let user: { id?: string | number } | null = null;
  try {
    const raw = fields.get("user");
    user = raw ? (JSON.parse(raw) as { id?: string | number }) : null;
  } catch {
    user = null;
  }
  if (!user || user.id === undefined || user.id === null) {
    return { ok: false, code: "INIT_USER_MISSING", message: "Telegram user identity is missing." };
  }

  return { ok: true, telegramUserId: String(user.id), authDate };
}
