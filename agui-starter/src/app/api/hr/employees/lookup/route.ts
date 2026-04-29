import { NextRequest, NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { lookupEntitiesForEmployee, normalizeEmployeeEmail, normalizeEmployeePhoneDetails } from "@/lib/hr/employee-identity";
import { resolveHrAccess } from "@/lib/hr/access";
import { resolveHrRouteActorContextWithoutFeatureGate } from "@/app/api/hr/_shared/route-guard-order";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/employees/lookup";

const LookupSchema = z.object({
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  houseId: z.string().trim().uuid(),
});

export async function POST(req: NextRequest) {
  const actor = await resolveHrRouteActorContextWithoutFeatureGate({
    routeName: ROUTE_NAME,
    onUnauthenticated: () => jsonError(401, "Not authenticated"),
    onEntityNotLinked: () => jsonError(403, "Account not linked"),
  });
  if (actor instanceof NextResponse) {
    return actor;
  }
  const { supabase, entityId, userId } = actor;

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
    userId,
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
    logApiError({ route: ROUTE_NAME, action: "resolve_house", userId, entityId, error });
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
    logApiError({ route: ROUTE_NAME, action: "lookup", userId, entityId, error: message });
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
