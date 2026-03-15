import { NextRequest } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import {
  createAdjustmentRunForHouse,
  PayrollRunAccessError,
  PayrollRunMutationError,
  PayrollRunNotFoundError,
  PayrollRunWrongStatusError,
} from "@/lib/hr/payroll-runs-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id/adjustments";

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

  let payload: { note?: string | null };
  try {
    payload = BodySchema.parse(await req.json().catch(() => ({})));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return jsonError(400, "Fix the highlighted fields and try again.", { message });
  }

  try {
    const result = await createAdjustmentRunForHouse(supabase, {
      houseId: parsedQuery.data.houseId,
      adjustsRunId: parsedParams.data.id,
      note: payload.note ?? null,
    });

    return jsonOk({ runId: result.runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PayrollRunAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: userResult.user.id,
        entityId,
        houseId: parsedQuery.data.houseId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return jsonError(403, "Not allowed", { message });
    }

    if (error instanceof PayrollRunNotFoundError) {
      return jsonError(404, "Payroll run not found", { message });
    }

    if (error instanceof PayrollRunWrongStatusError) {
      return jsonError(409, "Payroll run must be posted", { message });
    }

    if (error instanceof PayrollRunMutationError) {
      return jsonError(500, "Failed to create adjustment run", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "create_adjustment",
      userId: userResult.user.id,
      entityId,
      houseId: parsedQuery.data.houseId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return jsonError(500, "Failed to create adjustment run", { message });
  }
}
