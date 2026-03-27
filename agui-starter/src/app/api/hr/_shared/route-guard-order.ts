import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type ResolveHrRouteActorContextOptions = {
  routeName: string;
  features: AppFeature[];
  onUnauthenticated: () => NextResponse | Promise<NextResponse>;
  onEntityNotLinked: () => NextResponse | Promise<NextResponse>;
};

type HrRouteActorContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  entityId: string;
};

/**
 * Canonical guard order used by HR API route families:
 * 1) auth/session -> 2) entity resolution -> 3) feature gate.
 *
 * House/branch/domain checks stay in each route or domain resolver.
 */
export async function resolveHrRouteActorContext(
  options: ResolveHrRouteActorContextOptions,
): Promise<HrRouteActorContext | NextResponse> {
  const { routeName, features, onUnauthenticated, onEntityNotLinked } = options;

  let supabase: SupabaseClient<Database>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    logApiError({ route: routeName, action: "init_supabase_client", error });
    return jsonError(503, "Supabase not configured");
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) {
    logApiError({ route: routeName, action: "get_user", error: userError });
    return jsonError(500, "Failed to load user", { code: userError.code });
  }

  if (!userResult.user) {
    logApiWarning({ route: routeName, action: "unauthenticated" });
    return onUnauthenticated();
  }

  const admin = getServiceSupabase();
  let entityId: string | null = null;
  try {
    entityId = await resolveEntityIdForUser(userResult.user, admin);
  } catch (error) {
    logApiError({ route: routeName, action: "resolve_entity", userId: userResult.user.id, error });
    return jsonError(500, "Failed to resolve account");
  }

  if (!entityId) {
    logApiWarning({ route: routeName, action: "entity_not_linked", userId: userResult.user.id });
    return onEntityNotLinked();
  }

  const guard = await requireAnyFeatureAccessApi(features);
  if (guard) {
    return guard;
  }

  return {
    supabase,
    userId: userResult.user.id,
    entityId,
  };
}
