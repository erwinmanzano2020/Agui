import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  finalizePayrollRunForHouse,
  PayrollRunAccessError,
  PayrollRunFinalizedError,
  PayrollRunMutationError,
  PayrollRunNotFoundError,
  PayrollRunOpenSegmentsError,
  PayrollRunWrongStatusError,
  resolvePayrollRunWriteTargetForHouseWithAccess,
} from "@/lib/hr/payroll-runs-server";
import { z } from "@/lib/z";
import {
  payrollRouteAuthRequired,
  payrollRouteForbidden,
  payrollRouteNotFound,
  payrollRouteSuccess,
  payrollRouteUnexpected,
  payrollRouteValidation,
} from "../../route-boundary";

const ROUTE_NAME = "api/hr/payroll-runs/:id/finalize";
const SUCCESS_MESSAGE = "Payroll run finalized.";

const QuerySchema = z.object({
  houseId: z.string().trim().uuid(),
});

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK],
    onUnauthenticated: () => payrollRouteAuthRequired(),
    onEntityNotLinked: () => payrollRouteForbidden(),
  });
  if (actor instanceof Response) return actor;

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({ houseId: url.searchParams.get("houseId") });
  if (!parsedQuery.success) {
    const details = parsedQuery.error.flatten().formErrors;
    return payrollRouteValidation(details[0]);
  }

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    const details = parsedParams.error.flatten().formErrors;
    return payrollRouteValidation(details[0]);
  }

  try {
    const target = await resolvePayrollRunWriteTargetForHouseWithAccess(
      actor.supabase,
      parsedQuery.data.houseId,
      parsedParams.data.id,
    );
    if (!target) {
      return payrollRouteNotFound();
    }

    const result = await finalizePayrollRunForHouse(
      actor.supabase,
      parsedQuery.data.houseId,
      parsedParams.data.id,
      { resolvedTarget: target },
    );

    return payrollRouteSuccess({ run: result.run }, SUCCESS_MESSAGE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PayrollRunAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: actor.userId,
        entityId: actor.entityId,
        houseId: parsedQuery.data.houseId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return payrollRouteForbidden(message);
    }

    if (error instanceof PayrollRunNotFoundError) {
      return payrollRouteNotFound(message);
    }

    if (error instanceof PayrollRunFinalizedError) {
      return jsonError(409, "Payroll run already finalized", { message });
    }

    if (error instanceof PayrollRunWrongStatusError) {
      return jsonError(409, "Payroll run cannot be finalized", { message });
    }

    if (error instanceof PayrollRunOpenSegmentsError) {
      return jsonError(409, "Open segments exist for this period", { message });
    }

    if (error instanceof PayrollRunMutationError) {
      return payrollRouteUnexpected(message);
    }

    logApiError({
      route: ROUTE_NAME,
      action: "finalize_run",
      userId: actor.userId,
      entityId: actor.entityId,
      houseId: parsedQuery.data.houseId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return payrollRouteUnexpected(message);
  }
}
