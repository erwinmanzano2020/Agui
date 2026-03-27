import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  PayrollRunAccessError,
  PayrollRunAlreadyPostedError,
  PayrollRunMutationError,
  PayrollRunNotFoundError,
  PayrollRunOpenSegmentsError,
  PayrollRunWrongStatusError,
  postPayrollRunForHouse,
} from "@/lib/hr/payroll-runs-server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id/post";

const QuerySchema = z.object({
  houseId: z.string().trim().uuid(),
});

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const OptionalNullableString = z.string().trim().or(z.literal(null)).optional();

const BodySchema = z.object({
  postNote: OptionalNullableString,
});

export async function POST(
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

  let payload: { postNote?: string | null };
  try {
    payload = BodySchema.parse(await req.json().catch(() => ({})));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return jsonError(400, "Fix the highlighted fields and try again.", { message });
  }

  try {
    const result = await postPayrollRunForHouse(actor.supabase, {
      houseId: parsedQuery.data.houseId,
      runId: parsedParams.data.id,
      postNote: payload.postNote ?? null,
    });

    return jsonOk({ run: result });
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

    if (error instanceof PayrollRunNotFoundError) {
      return jsonError(404, "Payroll run not found", { message });
    }

    if (error instanceof PayrollRunAlreadyPostedError) {
      return jsonError(409, "Payroll run already posted", { message });
    }

    if (error instanceof PayrollRunWrongStatusError) {
      return jsonError(409, "Payroll run must be finalized", { message });
    }

    if (error instanceof PayrollRunOpenSegmentsError) {
      return jsonError(409, "Open segments exist for this period", { message });
    }

    if (error instanceof PayrollRunMutationError) {
      return jsonError(500, "Failed to post payroll run", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "post_run",
      userId: actor.userId,
      entityId: actor.entityId,
      houseId: parsedQuery.data.houseId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return jsonError(500, "Failed to post payroll run", { message });
  }
}
