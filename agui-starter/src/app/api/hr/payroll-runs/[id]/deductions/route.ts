import { NextRequest } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import {
  createPayrollRunDeduction,
  PayrollRunDeductionLockedError,
  PayrollRunDeductionMutationError,
  PayslipAccessError,
} from "@/lib/hr/payslip-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id/deductions";

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const BodySchema = z.object({
  employeeId: z.string().trim().uuid(),
  label: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

type BodyPayload = {
  employeeId: string;
  label: string;
  amount: number;
};

export async function POST(
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

  let payload: BodyPayload;
  try {
    payload = BodySchema.parse(await req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return jsonError(400, "Fix the highlighted fields and try again.", { message });
  }

  try {
    const result = await createPayrollRunDeduction(supabase, {
      runId: parsedParams.data.id,
      employeeId: payload.employeeId,
      label: payload.label,
      amount: payload.amount,
      createdBy: entityId,
    });

    return jsonOk({ id: result?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof PayrollRunDeductionLockedError) {
      return jsonError(409, "Payroll run is locked", { message });
    }

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

    if (error instanceof PayrollRunDeductionMutationError) {
      logApiError({
        route: ROUTE_NAME,
        action: "create_deduction",
        userId: userResult.user.id,
        entityId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return jsonError(500, "Failed to save deduction", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "create_deduction",
      userId: userResult.user.id,
      entityId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return jsonError(500, "Failed to save deduction", { message });
  }
}
