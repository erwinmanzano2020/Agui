import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  createAdjustmentRunForHouse,
  PayrollRunAccessError,
  PayrollRunMutationError,
  PayrollRunNotFoundError,
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

const ROUTE_NAME = "api/hr/payroll-runs/:id/adjustments";
const SUCCESS_MESSAGE = "Adjustment payroll run created.";

const QuerySchema = z.object({
  houseId: z.string().trim().uuid(),
});

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const OptionalNullableString = z.string().trim().or(z.literal(null)).optional();

const BodySchema = z.object({
  note: OptionalNullableString,
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

  let payload: { note?: string | null };
  try {
    payload = BodySchema.parse(await req.json().catch(() => ({})));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return payrollRouteValidation(message);
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

    const result = await createAdjustmentRunForHouse(actor.supabase, {
      houseId: parsedQuery.data.houseId,
      adjustsRunId: parsedParams.data.id,
      note: payload.note ?? null,
    }, { resolvedTarget: target });

    return payrollRouteSuccess({ runId: result.runId }, SUCCESS_MESSAGE);
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

    if (error instanceof PayrollRunWrongStatusError) {
      return jsonError(409, "Payroll run must be posted", { message });
    }

    if (error instanceof PayrollRunMutationError) {
      return payrollRouteUnexpected(message);
    }

    logApiError({
      route: ROUTE_NAME,
      action: "create_adjustment",
      userId: actor.userId,
      entityId: actor.entityId,
      houseId: parsedQuery.data.houseId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return payrollRouteUnexpected(message);
  }
}
