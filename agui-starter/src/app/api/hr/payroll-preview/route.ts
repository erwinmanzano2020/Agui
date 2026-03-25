import { NextRequest, NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  computePayrollPreviewForHousePeriod,
  PayrollPreviewAccessError,
  PayrollPreviewValidationError,
} from "@/lib/hr/payroll-preview-server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-preview";

const QuerySchema = z.object({
  houseId: z.string().trim().uuid(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  branchId: z.string().trim().uuid().optional(),
  employeeId: z.string().trim().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK],
    onUnauthenticated: () => jsonError(401, "Not authenticated"),
    onEntityNotLinked: () => jsonError(403, "Account not linked"),
  });
  if (actor instanceof NextResponse) return actor;
  const { supabase, userId, entityId } = actor;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    houseId: url.searchParams.get("houseId"),
    startDate: url.searchParams.get("startDate"),
    endDate: url.searchParams.get("endDate"),
    branchId: url.searchParams.get("branchId") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
  });

  if (!parsed.success) {
    const details = parsed.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", {
      message: details[0] ?? "Missing or invalid parameters.",
    });
  }

  try {
    const result = await computePayrollPreviewForHousePeriod(supabase, {
      houseId: parsed.data.houseId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      branchId: parsed.data.branchId ?? null,
      employeeId: parsed.data.employeeId ?? null,
    });

    return jsonOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PayrollPreviewAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId,
        entityId,
        houseId: parsed.data.houseId,
        error: message,
      });
      return jsonError(403, "Not allowed", { message });
    }

    if (error instanceof PayrollPreviewValidationError) {
      return jsonError(400, "Invalid payroll preview parameters", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "compute_preview",
      userId,
      entityId,
      houseId: parsed.data.houseId,
      error: message,
    });

    return jsonError(500, "Failed to compute payroll preview", { message });
  }
}
