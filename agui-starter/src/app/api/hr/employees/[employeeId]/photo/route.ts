import { NextRequest, NextResponse } from "next/server";

import { requireHrAccess } from "@/lib/hr/access";
import { updateEmployeeForHouseWithAccess } from "@/lib/hr/employees-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase-service";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidHouseId(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

async function persistPhoto(employeeId: string, houseId: string, photoUrl: string | null, photoPath: string | null, operationId: string | null) {
  const startedAt = Date.now();
  const supabase = await createServerSupabaseClient();
  const access = await requireHrAccess(supabase, houseId);

  if (!access.allowed) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const service = getServiceSupabase();
  const current = await service
    .from("employees")
    .select("full_name,status,branch_id,rate_per_day,position_title")
    .eq("house_id", houseId)
    .eq("id", employeeId)
    .maybeSingle();

  if (current.error) {
    return NextResponse.json({ error: "Unable to load employee profile" }, { status: 500 });
  }

  if (!current.data) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const updated = await updateEmployeeForHouseWithAccess(service, access, houseId, employeeId, {
    full_name: current.data.full_name,
    status: current.data.status,
    branch_id: current.data.branch_id,
    rate_per_day: Number(current.data.rate_per_day ?? 0),
    position_title: current.data.position_title,
    photo_url: photoUrl,
    photo_path: photoPath,
  });

  if (!updated) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  console.info("[hr][employee-photo][api] update_success", {
    operationId,
    employeeId,
    houseId,
    durationMs: Date.now() - startedAt,
    hasPhotoUrl: Boolean(updated.photo_url),
    hasPhotoPath: Boolean(updated.photo_path),
  });

  return NextResponse.json({ ok: true, photo_url: updated.photo_url ?? null, photo_path: updated.photo_path ?? null });
}

export async function POST(req: NextRequest, context: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await context.params;
  const raw = (await req.json().catch(() => null)) as { houseId?: unknown; photo_url?: unknown; photo_path?: unknown; operationId?: unknown } | null;
  const operationId = req.headers.get("x-photo-operation-id") || (typeof raw?.operationId === "string" ? raw.operationId : null);

  console.info("[hr][employee-photo][api] request_received", {
    method: "POST",
    operationId,
    employeeId,
    houseId: raw?.houseId ?? null,
  });

  if (!raw || !isValidHouseId(raw.houseId) || !isNullableString(raw.photo_url) || !isNullableString(raw.photo_path)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const houseId = raw.houseId.trim();
  const photoUrl = typeof raw.photo_url === "string" ? raw.photo_url.trim() || null : null;
  const photoPath = typeof raw.photo_path === "string" ? raw.photo_path.trim() || null : null;

  try {
    console.info("[hr][employee-photo][api] access_validated", { method: "POST", operationId, employeeId, houseId });
    return await persistPhoto(employeeId, houseId, photoUrl, photoPath, operationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist employee photo";
    console.error("[hr][employee-photo][api] persist_fail", { method: "POST", operationId, employeeId, houseId, message });
    return NextResponse.json({ error: "Unable to persist employee photo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await context.params;
  const raw = (await req.json().catch(() => null)) as { houseId?: unknown; operationId?: unknown } | null;
  const operationId = req.headers.get("x-photo-operation-id") || (typeof raw?.operationId === "string" ? raw.operationId : null);

  console.info("[hr][employee-photo][api] request_received", {
    method: "DELETE",
    operationId,
    employeeId,
    houseId: raw?.houseId ?? null,
  });

  if (!raw || !isValidHouseId(raw.houseId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const houseId = raw.houseId.trim();

  try {
    console.info("[hr][employee-photo][api] access_validated", { method: "DELETE", operationId, employeeId, houseId });
    return await persistPhoto(employeeId, houseId, null, null, operationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete employee photo";
    console.error("[hr][employee-photo][api] persist_fail", { method: "DELETE", operationId, employeeId, houseId, message });
    return NextResponse.json({ error: "Unable to delete employee photo" }, { status: 500 });
  }
}
