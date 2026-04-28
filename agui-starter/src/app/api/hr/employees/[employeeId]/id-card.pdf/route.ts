import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { getFeatureAccessDebugSnapshot } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { getEmployeeIdCardById } from "@/lib/hr/employee-id-cards-server";
import { generateEmployeeIdCardPdf } from "@/lib/hr/employee-id-card-pdf";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import { z } from "@/lib/z";

const ParamsSchema = z.object({ employeeId: z.string().trim().uuid() });
const ROUTE_NAME = "api/hr/employees/[employeeId]/id-card.pdf";

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
  const disposition = new URL(req.url).searchParams.get("disposition")?.trim();
  const contentDispositionType = disposition === "inline" ? "inline" : "attachment";

  const featureSnapshot = await getFeatureAccessDebugSnapshot([AppFeature.HR]);
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.HR],
    onUnauthenticated: () => jsonError(401, "Not authenticated"),
    onEntityNotLinked: () => jsonError(403, "Account not linked"),
  });
  if (actor instanceof NextResponse) {
    return actor;
  }
  const { supabase, entityId, userId } = actor;

  const access = await requireHrAccessWithBranch(supabase, { houseId });
  if (!access.allowed) {
    logApiWarning({
      route: ROUTE_NAME,
      action: "hr_access_denied",
      userId,
      entityId,
      houseId,
      details: {
        employeeId: parsed.data.employeeId,
        requiredFeatures: featureSnapshot.requiredFeatures,
        resolvedFeatures: featureSnapshot.resolvedFeatures,
      },
    });
    return jsonError(403, "Not allowed");
  }

  console.info("[hr][id-card.pdf] Access granted", {
    denyStage: "none",
    userId,
    houseId,
    employeeId: parsed.data.employeeId,
    requiredFeatures: featureSnapshot.requiredFeatures,
    resolvedFeatures: featureSnapshot.resolvedFeatures,
  });

  const card = await getEmployeeIdCardById(supabase, houseId, parsed.data.employeeId, {
    readScope: {
      isBranchLimited: access.isBranchLimited,
      allowedBranchIds: access.allowedBranchIds,
    },
  });
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
        "Content-Disposition": `${contentDispositionType}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logApiError({
      route: ROUTE_NAME,
      action: "generate_pdf",
      userId,
      entityId,
      houseId,
      error: reason,
      details: { employeeId: parsed.data.employeeId },
    });
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}
