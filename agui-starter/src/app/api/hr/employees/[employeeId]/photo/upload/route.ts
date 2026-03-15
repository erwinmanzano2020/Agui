import { NextRequest, NextResponse } from "next/server";

import { AppFeature } from "@/lib/auth/permissions";
import { buildEmployeePhotoPath } from "@/lib/hr/employee-photo";
import {
  requireActionPermission,
  requireAuthentication,
  requireMembership,
  requireModuleAccess,
} from "@/lib/access/access-check";
import { getServiceSupabase } from "@/lib/supabase-service";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidHouseId(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function isValidPhotoPath(value: string): boolean {
  return value.startsWith("employee-photos/") && (value.endsWith(".jpg") || value.endsWith(".png"));
}

function isPathOwnedByEmployee(path: string, employeeId: string): boolean {
  return path === buildEmployeePhotoPath(employeeId, "jpg") || path === buildEmployeePhotoPath(employeeId, "png");
}

async function authorizeEmployeePhotoUpload(houseId: string): Promise<boolean> {
  try {
    const authenticatedContext = await requireAuthentication(
      {
        scopeType: "house",
        scopeId: houseId,
      },
      { nextPath: "/employees" },
    );
    const memberContext = requireMembership(authenticatedContext);
    const moduleContext = await requireModuleAccess(AppFeature.HR, memberContext, { dest: "/employees" });

    // Keep existing HR-access behavior through the adapter layer by using
    // the canonical HR tile policy action while targeting the employee-photo resource.
    await requireActionPermission("tiles.hr.read", "employee.photo", moduleContext);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await context.params;
  const operationId = req.headers.get("x-photo-operation-id") || null;
  const startedAt = Date.now();

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload" }, { status: 400 });
  }

  const houseIdRaw = formData.get("houseId");
  const pathRaw = formData.get("path");
  const contentTypeRaw = formData.get("contentType");
  const fileRaw = formData.get("file");

  if (!isValidHouseId(houseIdRaw) || typeof pathRaw !== "string" || !isValidPhotoPath(pathRaw) || typeof contentTypeRaw !== "string" || !(fileRaw instanceof File)) {
    return NextResponse.json({ error: "Invalid upload payload" }, { status: 400 });
  }

  const houseId = houseIdRaw.trim();
  const path = pathRaw.trim();
  const contentType = contentTypeRaw.trim() || "image/jpeg";

  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  if (!isPathOwnedByEmployee(path, employeeId)) {
    return NextResponse.json({ error: "Path does not belong to employee" }, { status: 400 });
  }

  try {
    const hasAccess = await authorizeEmployeePhotoUpload(houseId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const arrayBuffer = await fileRaw.arrayBuffer();
    const service = getServiceSupabase();
    const upload = await service.storage.from("employee-photos").upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

    if (upload.error) {
      console.error("[hr][employee-photo][api-upload] upload_fail", {
        operationId,
        employeeId,
        houseId,
        path,
        contentType,
        size: fileRaw.size,
        message: upload.error.message,
        statusCode: (upload.error as { statusCode?: number }).statusCode ?? null,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({ error: upload.error.message || "Storage upload failed" }, { status: 500 });
    }

    console.info("[hr][employee-photo][api-upload] upload_success", {
      operationId,
      employeeId,
      houseId,
      path,
      contentType,
      size: fileRaw.size,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage upload failed";
    console.error("[hr][employee-photo][api-upload] upload_exception", {
      operationId,
      employeeId,
      houseId,
      path,
      contentType,
      size: fileRaw.size,
      message,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }
}
