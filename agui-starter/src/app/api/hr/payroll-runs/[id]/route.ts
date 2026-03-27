import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  getPayrollRunWithItems,
  PayrollRunAccessError,
  PayrollRunFetchError,
} from "@/lib/hr/payroll-runs-server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id";

const QuerySchema = z.object({
  houseId: z.string().trim().uuid(),
});

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK],
    onUnauthenticated: () => jsonError(401, "Not authenticated"),
    onEntityNotLinked: () => jsonError(403, "Account not linked"),
  });
  if (actor instanceof Response) return actor;

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({ houseId: url.searchParams.get("houseId") });
  if (!parsedQuery.success) {
    const details = parsedQuery.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", {
      message: details[0] ?? "Missing or invalid parameters.",
    });
  }

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    const details = parsedParams.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", {
      message: details[0] ?? "Missing or invalid parameters.",
    });
  }

  try {
    const result = await getPayrollRunWithItems(
      actor.supabase,
      parsedQuery.data.houseId,
      parsedParams.data.id,
    );

    if (!result) {
      return jsonError(404, "Payroll run not found");
    }

    return jsonOk(result);
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
      return jsonError(403, "Not allowed", { message });
    }

    if (error instanceof PayrollRunFetchError) {
      logApiError({
        route: ROUTE_NAME,
        action: "fetch_run",
        userId: actor.userId,
        entityId: actor.entityId,
        houseId: parsedQuery.data.houseId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return jsonError(500, "Failed to load payroll run", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "get_run",
      userId: actor.userId,
      entityId: actor.entityId,
      houseId: parsedQuery.data.houseId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return jsonError(500, "Failed to load payroll run", { message });
  }
}
