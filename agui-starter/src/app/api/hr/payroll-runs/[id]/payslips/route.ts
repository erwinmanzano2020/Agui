import { NextRequest, NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  computePayslipsForPayrollRun,
  PayslipAccessError,
  PayslipFetchError,
  PayslipValidationError,
} from "@/lib/hr/payslip-server";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id/payslips";

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const QuerySchema = z.object({
  employeeId: z.string().trim().uuid().optional(),
  houseId: z.string().trim().uuid().optional(),
});

async function listActorHouseIds(
  supabase: Parameters<typeof requireHrAccessWithBranch>[0],
  entityId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("house_roles")
    .select("house_id, created_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new PayslipFetchError(error.message);
  }

  const unique = new Set<string>();
  for (const row of data ?? []) {
    const houseId = (row as { house_id?: string | null }).house_id;
    if (houseId) unique.add(houseId);
  }
  return Array.from(unique.values());
}

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
  if (actor instanceof NextResponse) return actor;
  const { supabase, userId, entityId } = actor;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    const details = parsedParams.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", {
      message: details[0] ?? "Missing or invalid parameters.",
    });
  }

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    houseId: url.searchParams.get("houseId") ?? undefined,
  });

  if (!parsedQuery.success) {
    const details = parsedQuery.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", {
      message: details[0] ?? "Missing or invalid parameters.",
    });
  }

  try {
    const { employeeId, houseId: explicitHouseId } = parsedQuery.data;
    const houseIds = explicitHouseId ? [explicitHouseId] : await listActorHouseIds(supabase, entityId);
    let attemptedAllowedHouse = false;

    for (const houseId of houseIds) {
      const access = await requireHrAccessWithBranch(supabase, { houseId });
      if (!access.allowed) {
        continue;
      }
      attemptedAllowedHouse = true;

      const { data: run, error: runError } = await supabase
        .from("hr_payroll_runs")
        .select("id, house_id")
        .eq("id", parsedParams.data.id)
        .eq("house_id", houseId)
        .maybeSingle<{ id: string; house_id: string }>();

      if (runError) {
        throw new PayslipFetchError(runError.message);
      }

      if (!run) {
        continue;
      }

      const rows = await computePayslipsForPayrollRun(
        supabase,
        {
          houseId: run.house_id,
          runId: parsedParams.data.id,
          employeeId,
        },
        {
          access,
          branchScope: {
            isBranchLimited: access.isBranchLimited,
            allowedBranchIds: access.allowedBranchIds,
          },
        },
      );

      if (employeeId) {
        return jsonOk(rows[0] ?? null);
      }

      return jsonOk(rows);
    }

    if (!attemptedAllowedHouse) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId,
        entityId,
        details: { runId: parsedParams.data.id },
      });
      return jsonError(403, "Not allowed");
    }

    if (explicitHouseId) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "run_not_found",
        userId,
        entityId,
        details: { runId: parsedParams.data.id },
      });
    }

    return jsonError(404, "Payroll run not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PayslipAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId,
        entityId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return jsonError(403, "Not allowed", { message });
    }

    if (error instanceof PayslipValidationError) {
      return jsonError(400, "Invalid payslip parameters", { message });
    }

    if (error instanceof PayslipFetchError) {
      logApiError({
        route: ROUTE_NAME,
        action: "fetch_payslips",
        userId,
        entityId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return jsonError(500, "Failed to load payslips", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "get_payslips",
      userId,
      entityId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return jsonError(500, "Failed to load payslips", { message });
  }
}
