import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { lookupEntitiesForEmployee, normalizeEmployeeEmail, normalizeEmployeePhoneDetails } from "@/lib/hr/employee-identity";
import { resolveHrAccess } from "@/lib/hr/access";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db.types";

const ROUTE_NAME = "api/hr/employees/lookup";

const LookupSchema = z.object({
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  houseId: z.string().trim().uuid(),
});

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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (error) {
    logApiWarning({ route: ROUTE_NAME, action: "invalid_json", error });
    return jsonError(400, "Invalid JSON payload");
  }

  const parsed = LookupSchema.safeParse(payload);
  if (!parsed.success) {
    const details = parsed.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", { message: details[0] ?? "Missing houseId." });
  }

  const normalizedEmail = normalizeEmployeeEmail(parsed.data.email ?? null);
  const normalizedPhone = normalizeEmployeePhoneDetails(parsed.data.phone ?? null);

  if (!normalizedEmail && !normalizedPhone) {
    return jsonError(400, "Provide an email or phone to look up an identity.");
  }

  logApiWarning({
    route: ROUTE_NAME,
    action: "lookup_request",
    userId: userResult.user.id,
    entityId,
    houseId: parsed.data.houseId,
    details: {
      emailProvided: Boolean(normalizedEmail),
      phoneProvided: Boolean(normalizedPhone),
    },
  });

  try {
    const hrAccess = await resolveHrAccess(supabase, parsed.data.houseId);
    if (!hrAccess.allowed) {
      return jsonError(403, "Not allowed");
    }
  } catch (error) {
    logApiError({ route: ROUTE_NAME, action: "resolve_house", userId: userResult.user.id, entityId, error });
    return jsonError(500, "Failed to resolve house");
  }

  try {
    const matches = await lookupEntitiesForEmployee(supabase, {
      houseId: parsed.data.houseId,
      email: normalizedEmail,
      phone: normalizedPhone?.e164 ?? null,
    });

    return jsonOk({ matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logApiError({ route: ROUTE_NAME, action: "lookup", userId: userResult.user.id, entityId, error: message });
    if (message.toLowerCase().includes("schema")) {
      return jsonError(503, "Identity lookup unavailable: run latest migrations and reload PostgREST schema.", {
        message,
      });
    }
    if (message.toLowerCase().includes("not allowed")) {
      return jsonError(403, "Not allowed to look up identities", { message });
    }
    return jsonError(500, "Failed to look up identities", { message });
  }
}
