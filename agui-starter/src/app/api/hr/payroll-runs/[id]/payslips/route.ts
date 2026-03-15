import { NextRequest } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import {
  computePayslipsForPayrollRun,
  PayslipAccessError,
  PayslipFetchError,
  PayslipValidationError,
} from "@/lib/hr/payslip-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id/payslips";

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const QuerySchema = z.object({
  employeeId: z.string().trim().uuid().optional(),
  houseId: z.string().trim().uuid().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAnyFeatureAccessApi([
    AppFeature.PAYROLL,
    AppFeature.TEAM,
    AppFeature.DTR_BULK,
  ]);
  if (guard) return guard;

  let supabase: SupabaseClient<Database>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    logApiError({ route: ROUTE_NAME, action: "init_supabase_client", error });
    return jsonError(503, "Supabase not configured");
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) {
    logApiError({ route: ROUTE_NAME, action: "get_user", error: userError });
    return jsonError(500, "Failed to load user", { code: userError.code });
  }

  if (!userResult.user) {
    logApiWarning({ route: ROUTE_NAME, action: "unauthenticated" });
    return jsonError(401, "Not authenticated");
  }

  const admin = getServiceSupabase();
  let entityId: string | null = null;
  try {
    entityId = await resolveEntityIdForUser(userResult.user, admin);
  } catch (error) {
    logApiError({ route: ROUTE_NAME, action: "resolve_entity", userId: userResult.user.id, error });
    return jsonError(500, "Failed to resolve account");
  }

  if (!entityId) {
    logApiWarning({ route: ROUTE_NAME, action: "entity_not_linked", userId: userResult.user.id });
    return jsonError(403, "Account not linked");
  }

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
    const { employeeId, houseId } = parsedQuery.data;
    if (!houseId) {
      const { data: run, error: runError } = await supabase
        .from("hr_payroll_runs")
        .select("id, house_id")
        .eq("id", parsedParams.data.id)
        .maybeSingle<{ id: string; house_id: string }>();

      if (runError) {
        throw new PayslipFetchError(runError.message);
      }

      if (!run) {
        return jsonError(404, "Payroll run not found");
      }

      const rows = await computePayslipsForPayrollRun(supabase, {
        houseId: run.house_id,
        runId: parsedParams.data.id,
        employeeId,
      });

      if (employeeId) {
        return jsonOk(rows[0] ?? null);
      }

      return jsonOk(rows);
    }

    const rows = await computePayslipsForPayrollRun(supabase, {
      houseId,
      runId: parsedParams.data.id,
      employeeId,
    });

    if (employeeId) {
      return jsonOk(rows[0] ?? null);
    }

    return jsonOk(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PayslipAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: userResult.user.id,
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
        userId: userResult.user.id,
        entityId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return jsonError(500, "Failed to load payslips", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "get_payslips",
      userId: userResult.user.id,
      entityId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return jsonError(500, "Failed to load payslips", { message });
  }
}
