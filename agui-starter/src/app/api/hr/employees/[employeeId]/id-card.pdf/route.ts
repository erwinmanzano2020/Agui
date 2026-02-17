import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api/http";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireHrAccess } from "@/lib/hr/access";
import { getEmployeeIdCardById } from "@/lib/hr/employee-id-cards-server";
import { generateEmployeeIdCardPdf } from "@/lib/hr/employee-id-card-pdf";
import { z } from "@/lib/z";

const ParamsSchema = z.object({ employeeId: z.string().trim().uuid() });

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const guard = await requireAnyFeatureAccessApi([AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK]);
  if (guard) return guard;

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return jsonError(400, "Invalid employee id");
  }

  const supabase = await createServerSupabaseClient();

  const houseId = new URL(req.url).searchParams.get("houseId")?.trim();
  if (!houseId) {
    return jsonError(400, "houseId is required");
  }

  const access = await requireHrAccess(supabase, houseId);
  if (!access.allowed) {
    return jsonError(403, "Not allowed");
  }

  const card = await getEmployeeIdCardById(supabase, houseId, parsed.data.employeeId);
  if (!card) {
    return jsonError(404, "Employee not found");
  }

  try {
    const bytes = await generateEmployeeIdCardPdf(card);
    const filename = `EmployeeID-${sanitizeFilename(card.code)}-${sanitizeFilename(card.id)}.pdf`;

    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError(500, "Failed to generate QR code");
  }
}
