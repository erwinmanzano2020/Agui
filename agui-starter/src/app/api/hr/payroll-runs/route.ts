import { NextRequest } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import {
  createDraftPayrollRunFromPreview,
  listPayrollRunsForHouse,
  PayrollRunAccessError,
  PayrollRunMutationError,
  PayrollRunValidationError,
} from "@/lib/hr/payroll-runs-server";
import {
  PayrollPreviewAccessError,
  PayrollPreviewValidationError,
} from "@/lib/hr/payroll-preview-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";
import {
  payrollRouteAuthRequired,
  payrollRouteForbidden,
  payrollRouteSuccess,
  payrollRouteUnexpected,
  payrollRouteValidation,
} from "./route-boundary";

const ROUTE_NAME = "api/hr/payroll-runs";
const SUCCESS_MESSAGE = "Payroll run created.";

const QuerySchema = z.object({
  houseId: z.string().trim().uuid(),
});

const CreateSchema = z.object({
  houseId: z.string().trim().uuid(),
  periodStart: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
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
    return payrollRouteAuthRequired();
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
    return payrollRouteForbidden();
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ houseId: url.searchParams.get("houseId") });
  if (!parsed.success) {
    const details = parsed.error.flatten().formErrors;
    return payrollRouteValidation(details[0], "Missing or invalid house.");
  }

  try {
    const runs = await listPayrollRunsForHouse(supabase, parsed.data.houseId);
    return jsonOk({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PayrollRunAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: userResult.user.id,
        entityId,
        houseId: parsed.data.houseId,
        error: message,
      });
      return payrollRouteForbidden(message);
    }

    logApiError({
      route: ROUTE_NAME,
      action: "list_runs",
      userId: userResult.user.id,
      entityId,
      houseId: parsed.data.houseId,
      error: message,
    });

    return payrollRouteUnexpected(message);
  }
}

export async function POST(req: NextRequest) {
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
    return payrollRouteAuthRequired();
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
    return payrollRouteForbidden();
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (error) {
    logApiWarning({ route: ROUTE_NAME, action: "invalid_json", error });
    return payrollRouteValidation("Invalid JSON payload.");
  }

  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    const details = parsed.error.flatten().formErrors;
    return payrollRouteValidation(details[0]);
  }

  try {
    const result = await createDraftPayrollRunFromPreview(supabase, {
      houseId: parsed.data.houseId,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      createdBy: entityId,
    });

    return payrollRouteSuccess({ runId: result.runId }, SUCCESS_MESSAGE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PayrollRunAccessError || error instanceof PayrollPreviewAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: userResult.user.id,
        entityId,
        houseId: parsed.data.houseId,
        error: message,
      });
      return payrollRouteForbidden(message);
    }

    if (error instanceof PayrollRunValidationError || error instanceof PayrollPreviewValidationError) {
      return payrollRouteValidation(message, "Invalid payroll run parameters.");
    }

    if (error instanceof PayrollRunMutationError) {
      if (error.code === "23505") {
        return jsonError(409, "Duplicate payroll run items", { message });
      }
      if (error.code === "23514") {
        return jsonError(400, "House mismatch", { message });
      }
      return payrollRouteUnexpected(message);
    }

    logApiError({
      route: ROUTE_NAME,
      action: "create_run",
      userId: userResult.user.id,
      entityId,
      houseId: parsed.data.houseId,
      error: message,
    });

    return payrollRouteUnexpected(message);
  }
}
