import { NextRequest, NextResponse } from "next/server";

import { AuthorizationDeniedError, isAuthorizationDeniedError } from "@/lib/access/access-errors";
import { requireAuthentication } from "@/lib/access/access-check";
import { buildEmployeePhotoPath } from "@/lib/hr/employee-photo";
import { requireHrAccess } from "@/lib/hr/access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

async function requireEmployeePhotoUploadAuthentication(houseId: string): Promise<void> {
  await requireAuthentication(
    {
      scopeType: "house",
      scopeId: houseId,
    },
    { nextPath: "/employees" },
  );
}

async function requireEmployeePhotoUploadHrAccess(houseId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const access = await requireHrAccess(supabase, houseId);
  if (!access.allowed) {
    throw new AuthorizationDeniedError();
  }
}

async function resolveEmployeeHouseId(employeeId: string): Promise<string | null> {
  const service = getServiceSupabase();
  const employee = await service.from("employees").select("house_id").eq("id", employeeId).maybeSingle<{ house_id: string }>();

  if (employee.error) {
    throw new Error("Unable to verify employee ownership");
  }

  return employee.data?.house_id?.trim() || null;
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
    await requireEmployeePhotoUploadAuthentication(houseId);

    const employeeHouseId = await resolveEmployeeHouseId(employeeId);
    if (!employeeHouseId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (employeeHouseId !== houseId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    await requireEmployeePhotoUploadHrAccess(employeeHouseId);
  } catch (error) {
    if (isAuthorizationDeniedError(error)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

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

  try {
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
