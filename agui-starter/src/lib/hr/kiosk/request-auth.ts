import type { SupabaseClient } from "@supabase/supabase-js";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";

type DeviceRow = {
  id: string;
  house_id: string;
  branch_id: string;
  is_active: boolean;
  disabled_at: string | null;
  name: string;
};

type HouseSlugRow = { slug: string | null };

export class KioskRequestAuthError extends Error {
  readonly status: number;
  readonly reason: string;

  constructor(message: string, status: number, reason: string) {
    super(message);
    this.name = "KioskRequestAuthError";
    this.status = status;
    this.reason = reason;
  }
}

export function readBearerKioskToken(request: Request): string {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }

  const legacyToken = request.headers.get("x-kiosk-token")?.trim();
  if (legacyToken) return legacyToken;

  throw new KioskRequestAuthError("Missing Authorization bearer token.", 401, "missing_token");
}

export async function requireKioskDevice(
  supabase: SupabaseClient,
  requestOrToken: Request | string,
  options?: { expectedSlug?: string | null },
): Promise<{ deviceId: string; houseId: string; branchId: string; deviceName: string; token: string }> {
  const token = typeof requestOrToken === "string" ? requestOrToken : readBearerKioskToken(requestOrToken);
  const tokenHash = hashKioskToken(token);

  const { data: device, error } = await supabase
    .from("hr_kiosk_devices")
    .select("id, house_id, branch_id, is_active, disabled_at, name")
    .eq("token_hash", tokenHash)
    .maybeSingle<DeviceRow>();

  if (error) {
    throw new KioskRequestAuthError(error.message, 500, "device_lookup_failed");
  }
  if (!device) {
    throw new KioskRequestAuthError("Invalid kiosk token", 401, "invalid_token");
  }
  if (!device.is_active || device.disabled_at) {
    throw new KioskRequestAuthError("Device disabled. Contact HR.", 403, "device_disabled");
  }

  if (options?.expectedSlug) {
    const { data: house, error: houseError } = await supabase
      .from("houses")
      .select("slug")
      .eq("id", device.house_id)
      .maybeSingle<HouseSlugRow>();

    if (houseError) {
      throw new KioskRequestAuthError(houseError.message, 500, "house_lookup_failed");
    }

    if (!house || house.slug !== options.expectedSlug) {
      throw new KioskRequestAuthError("Kiosk token is not valid for this workspace.", 403, "slug_mismatch");
    }
  }

  return {
    token,
    deviceId: device.id,
    houseId: device.house_id,
    branchId: device.branch_id,
    deviceName: device.name,
  };
}
