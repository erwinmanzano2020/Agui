import type { SupabaseClient } from "@supabase/supabase-js";

import { createKioskDeviceToken, hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import { requireHrAccess, requireHrAccessWithBranch } from "@/lib/hr/access";

export type KioskDeviceAdminRow = {
  id: string;
  house_id: string;
  branch_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
  last_event_at: string | null;
  disabled_at: string | null;
  disabled_by: string | null;
  branch?: { id: string; name: string } | null;
};

export type KioskDeviceEventRow = {
  id: string;
  device_id: string;
  occurred_at: string;
  event_type: string;
  employee_id: string | null;
  metadata: Record<string, unknown>;
};

export class KioskAdminError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "KioskAdminError";
    this.status = status;
  }
}

async function assertHrAccess(
  supabase: SupabaseClient,
  houseId: string,
  branchId?: string | null,
): Promise<Awaited<ReturnType<typeof requireHrAccessWithBranch>>> {
  const access = await requireHrAccessWithBranch(supabase, { houseId, branchId });
  if (!access.allowed) {
    throw new KioskAdminError("HR access required.", 403);
  }
  return access;
}

async function assertHouseHrAccess(
  supabase: SupabaseClient,
  houseId: string,
): Promise<void> {
  const access = await requireHrAccess(supabase, houseId);
  if (!access.allowed) {
    throw new KioskAdminError("HR access required.", 403);
  }
}

async function assertBranchInHouse(
  supabase: SupabaseClient,
  houseId: string,
  branchId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("house_id", houseId)
    .maybeSingle();

  if (error) {
    throw new KioskAdminError(error.message, 500);
  }

  if (!data) {
    throw new KioskAdminError("Branch is not part of this house.", 403);
  }
}

async function getDeviceForHouseWithBranch(
  supabase: SupabaseClient,
  houseId: string,
  deviceId: string,
): Promise<{ id: string; house_id: string; branch_id: string }> {
  const { data, error } = await supabase
    .from("hr_kiosk_devices")
    .select("id, house_id, branch_id")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) {
    throw new KioskAdminError(error.message, 500);
  }
  if (!data || data.house_id !== houseId) {
    throw new KioskAdminError("Device not found.", 404);
  }
  return data as { id: string; house_id: string; branch_id: string };
}

export async function listKioskDevicesForHouse(
  supabase: SupabaseClient,
  houseId: string,
  branchId?: string,
): Promise<KioskDeviceAdminRow[]> {
  const access = await assertHrAccess(supabase, houseId, branchId ?? null);
  if (branchId) {
    await assertBranchInHouse(supabase, houseId, branchId);
  }

  let query = supabase
    .from("hr_kiosk_devices")
    .select("id, house_id, branch_id, name, is_active, created_at, last_seen_at, last_event_at, disabled_at, disabled_by, branch:branches(id, name)")
    .eq("house_id", houseId)
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  } else if (access.isBranchLimited) {
    query = query.in("branch_id", access.allowedBranchIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new KioskAdminError(error.message, 500);
  }
  return (data ?? []) as unknown as KioskDeviceAdminRow[];
}

export async function createKioskDeviceForBranch(
  supabase: SupabaseClient,
  input: { houseId: string; branchId: string; name: string },
): Promise<{ deviceRow: KioskDeviceAdminRow; plaintextToken: string }> {
  await assertHrAccess(supabase, input.houseId, input.branchId);
  await assertBranchInHouse(supabase, input.houseId, input.branchId);

  const plaintextToken = createKioskDeviceToken();
  const tokenHash = hashKioskToken(plaintextToken);

  const { data, error } = await supabase
    .from("hr_kiosk_devices")
    .insert({
      house_id: input.houseId,
      branch_id: input.branchId,
      name: input.name.trim(),
      token_hash: tokenHash,
      is_active: true,
      disabled_at: null,
      disabled_by: null,
    })
    .select("id, house_id, branch_id, name, is_active, created_at, last_seen_at, last_event_at, disabled_at, disabled_by")
    .single();

  if (error) {
    throw new KioskAdminError(error.message, 500);
  }

  return {
    deviceRow: data as KioskDeviceAdminRow,
    plaintextToken,
  };
}

export async function rotateKioskDeviceToken(
  supabase: SupabaseClient,
  input: { houseId: string; deviceId: string },
): Promise<{ plaintextToken: string }> {
  await assertHouseHrAccess(supabase, input.houseId);
  const device = await getDeviceForHouseWithBranch(supabase, input.houseId, input.deviceId);
  await assertHrAccess(supabase, input.houseId, device.branch_id);

  const plaintextToken = createKioskDeviceToken();
  const tokenHash = hashKioskToken(plaintextToken);

  const { error } = await supabase
    .from("hr_kiosk_devices")
    .update({ token_hash: tokenHash })
    .eq("id", input.deviceId)
    .eq("house_id", input.houseId);

  if (error) {
    throw new KioskAdminError(error.message, 500);
  }

  return { plaintextToken };
}

export async function setKioskDeviceEnabled(
  supabase: SupabaseClient,
  input: { houseId: string; deviceId: string; enabled: boolean; actorEntityId?: string | null },
): Promise<void> {
  await assertHouseHrAccess(supabase, input.houseId);
  const device = await getDeviceForHouseWithBranch(supabase, input.houseId, input.deviceId);
  await assertHrAccess(supabase, input.houseId, device.branch_id);

  const payload = input.enabled
    ? { is_active: true, disabled_at: null, disabled_by: null }
    : { is_active: false, disabled_at: new Date().toISOString(), disabled_by: input.actorEntityId ?? null };

  const { error } = await supabase
    .from("hr_kiosk_devices")
    .update(payload)
    .eq("id", input.deviceId)
    .eq("house_id", input.houseId);

  if (error) {
    throw new KioskAdminError(error.message, 500);
  }
}

export async function listKioskDeviceEvents(
  supabase: SupabaseClient,
  input: { houseId: string; deviceId: string; limit?: number },
): Promise<KioskDeviceEventRow[]> {
  await assertHouseHrAccess(supabase, input.houseId);
  const device = await getDeviceForHouseWithBranch(supabase, input.houseId, input.deviceId);
  await assertHrAccess(supabase, input.houseId, device.branch_id);

  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
  const { data, error } = await supabase
    .from("hr_kiosk_events")
    .select("id, device_id, occurred_at, event_type, employee_id, metadata")
    .eq("house_id", input.houseId)
    .eq("device_id", input.deviceId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new KioskAdminError(error.message, 500);
  }

  return (data ?? []) as KioskDeviceEventRow[];
}
