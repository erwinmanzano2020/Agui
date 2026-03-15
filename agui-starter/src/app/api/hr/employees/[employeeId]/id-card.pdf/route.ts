import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api/http";
import { getFeatureAccessDebugSnapshot } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireHrAccess } from "@/lib/hr/access";
import { getEmployeeIdCardById } from "@/lib/hr/employee-id-cards-server";
import { generateEmployeeIdCardPdf } from "@/lib/hr/employee-id-card-pdf";
import { z } from "@/lib/z";

const ParamsSchema = z.object({ employeeId: z.string().trim().uuid() });

export const runtime = "nodejs";

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return jsonError(400, "Invalid employee id");
  }

  const houseId = new URL(req.url).searchParams.get("houseId")?.trim();
  if (!houseId) {
    return jsonError(400, "houseId is required");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const featureSnapshot = await getFeatureAccessDebugSnapshot([AppFeature.HR]);

  const access = await requireHrAccess(supabase, houseId);
  if (!access.allowed) {
    console.warn("[hr][id-card.pdf] Forbidden by HR access guard", {
      denyStage: "hr_access",
      userId: user?.id ?? null,
      houseId,
      employeeId: parsed.data.employeeId,
      requiredFeatures: featureSnapshot.requiredFeatures,
      resolvedFeatures: featureSnapshot.resolvedFeatures,
      entityId: access.entityId,
      roles: access.roles,
      policyKeys: access.policyKeys,
    });
    return jsonError(403, "Not allowed");
  }

  console.info("[hr][id-card.pdf] Access granted", {
    denyStage: "none",
    userId: user?.id ?? null,
    houseId,
    employeeId: parsed.data.employeeId,
    requiredFeatures: featureSnapshot.requiredFeatures,
    resolvedFeatures: featureSnapshot.resolvedFeatures,
  });

  const card = await getEmployeeIdCardById(supabase, houseId, parsed.data.employeeId);
  if (!card) {
    return jsonError(404, "Employee not found");
  }

  try {
    const bytes = await generateEmployeeIdCardPdf(card, { frontLayout: "modern" });
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
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[hr][id-card.pdf] Failed to generate QR code", { reason, stack, employeeId: parsed.data.employeeId });
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}
