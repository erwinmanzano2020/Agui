import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api/http";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireHrAccess } from "@/lib/hr/access";
import { generateEmployeeIdCardsSheetPdf } from "@/lib/hr/employee-id-card-pdf";
import { orderEmployeeIdCards } from "@/lib/hr/employee-id-cards";
import { listEmployeeIdCards } from "@/lib/hr/employee-id-cards-server";
import { z } from "@/lib/z";

const HouseIdSchema = z.string().trim().uuid();
const MAX_EMPLOYEE_IDS = 200;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAnyFeatureAccessApi([AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK]);
  if (guard) return guard;

  const raw = (await req.json().catch(() => null)) as {
    houseId?: unknown;
    employeeIds?: unknown;
    layout?: unknown;
    includeCutGuides?: unknown;
  } | null;

  if (!raw) return jsonError(400, "Invalid payload");

  const parsedHouseId = HouseIdSchema.safeParse(raw.houseId);
  if (!parsedHouseId.success) return jsonError(400, "Invalid payload");

  if (!Array.isArray(raw.employeeIds) || raw.employeeIds.length === 0) {
    return jsonError(400, "employeeIds must contain at least one employee");
  }

  if (raw.employeeIds.length > MAX_EMPLOYEE_IDS) {
    return jsonError(400, "Too many employees requested");
  }

  const employeeIds = raw.employeeIds.filter((id): id is string => typeof id === "string");
  if (employeeIds.length !== raw.employeeIds.length) {
    return jsonError(400, "employeeIds must be a list of strings");
  }

  const layout = raw.layout === "a4_9up" || raw.layout === "a4_8up" ? raw.layout : undefined;
  const includeCutGuides = typeof raw.includeCutGuides === "boolean" ? raw.includeCutGuides : undefined;

  const supabase = await createServerSupabaseClient();
  const houseId = parsedHouseId.data;

  const access = await requireHrAccess(supabase, houseId);
  if (!access.allowed) {
    return jsonError(403, "Not allowed");
  }

  const allEmployees = await listEmployeeIdCards(supabase, houseId);
  const allowed = new Map(allEmployees.map((row) => [row.id, row]));
  const selected = employeeIds
    .map((id) => allowed.get(id) ?? null)
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (selected.length !== employeeIds.length) {
    return jsonError(403, "One or more employees are outside this house.");
  }

  try {
    const ordered = orderEmployeeIdCards(selected);
    const bytes = await generateEmployeeIdCardsSheetPdf(ordered, { layout, includeCutGuides });

    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="EmployeeIDs-A4.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[hr][employee-ids/print] Failed to generate QR code", { reason, stack, houseId });
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}
