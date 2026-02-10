import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import {
  KioskAdminError,
  createKioskDeviceForBranch,
  listKioskDevicesForHouse,
} from "@/lib/hr/kiosk/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const GetSchema = z.object({
  houseId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

const CreateSchema = z.object({
  houseId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

async function getAuthedSupabase() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { error: jsonError(500, "Failed to load user") };
  if (!data.user) return { error: jsonError(401, "Not authenticated") };
  return { supabase };
}

function toErrorResponse(error: unknown) {
  if (error instanceof KioskAdminError) {
    return jsonError(error.status, error.message);
  }
  return jsonError(500, error instanceof Error ? error.message : "Internal server error");
}

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase();
  if ("error" in authed) return authed.error;

  const url = new URL(req.url);
  const parsed = GetSchema.safeParse({
    houseId: url.searchParams.get("houseId"),
    branchId: url.searchParams.get("branchId") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(400, "Invalid query", { issues: parsed.error.issues });
  }

  try {
    const devices = await listKioskDevicesForHouse(
      authed.supabase,
      parsed.data.houseId,
      parsed.data.branchId,
    );
    return jsonOk({ devices });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase();
  if ("error" in authed) return authed.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON payload");
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid payload", { issues: parsed.error.issues });
  }

  try {
    const result = await createKioskDeviceForBranch(authed.supabase, parsed.data);
    return jsonOk({ device: result.deviceRow, token: result.plaintextToken });
  } catch (error) {
    return toErrorResponse(error);
  }
}
