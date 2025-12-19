import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { listEmployeesByHouse } from "@/lib/hr/employees-server";
import { resolveHrAccess } from "@/lib/hr/access";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, HouseRoleRow } from "@/lib/db.types";

const ROUTE_NAME = "api/hr/employees";

async function resolveHouseForEntity(
  service: SupabaseClient<Database>,
  entityId: string,
  explicitHouseId?: string | null,
): Promise<string | null> {
  const requestedHouseId = explicitHouseId?.trim();
  if (requestedHouseId) {
    const { data, error } = await service
      .from("house_roles")
      .select("house_id")
      .eq("entity_id", entityId)
      .eq("house_id", requestedHouseId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data as Pick<HouseRoleRow, "house_id"> | null)?.house_id ?? null;
  }

  const { data, error } = await service
    .from("house_roles")
    .select("house_id")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Pick<HouseRoleRow, "house_id">[];
  return rows[0]?.house_id ?? null;
}

async function resolveBranchesForHouse(
  service: SupabaseClient<Database>,
  houseId: string,
): Promise<string[]> {
  const { data, error } = await service
    .from("branches")
    .select("id")
    .eq("house_id", houseId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => (row as { id?: string | null }).id)
    .filter((id): id is string => Boolean(id));
}

export async function GET(req: NextRequest) {
  const guard = await requireAnyFeatureAccessApi([
    AppFeature.PAYROLL,
    AppFeature.TEAM,
    AppFeature.DTR_BULK,
  ]);
  if (guard) {
    return guard;
  }

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

  const authed = supabase;
  const admin = getServiceSupabase();
  let entityId: string | null = null;
  try {
    entityId = await resolveEntityIdForUser(userResult.user, admin);
  } catch (error) {
    logApiError({
      route: ROUTE_NAME,
      action: "resolve_entity",
      userId: userResult.user.id,
      error,
    });
    return jsonError(500, "Failed to resolve account");
  }

  if (!entityId) {
    logApiWarning({ route: ROUTE_NAME, action: "entity_not_linked", userId: userResult.user.id });
    return jsonError(403, "Account not linked");
  }

  const url = new URL(req.url);
  const requestedHouseId = url.searchParams.get("houseId");

  let houseId: string | null = null;
  try {
    houseId = await resolveHouseForEntity(authed, entityId, requestedHouseId);
  } catch (error) {
    logApiError({
      route: ROUTE_NAME,
      action: "resolve_house",
      userId: userResult.user.id,
      entityId,
      error,
    });
    return jsonError(500, "Failed to resolve house");
  }

  if (!houseId) {
    logApiWarning({
      route: ROUTE_NAME,
      action: "no_accessible_house",
      userId: userResult.user.id,
      entityId,
    });
    return jsonError(403, "No accessible house");
  }

  let branchIds: string[] = [];
  try {
    branchIds = await resolveBranchesForHouse(authed, houseId);
  } catch (error) {
    logApiError({
      route: ROUTE_NAME,
      action: "resolve_branches",
      userId: userResult.user.id,
      entityId,
      houseId,
      error,
    });
    return jsonError(500, "Failed to resolve house departments");
  }

  const hrAccess = await resolveHrAccess(authed, houseId);
  if (!hrAccess.allowed) {
    logApiWarning({
      route: ROUTE_NAME,
      action: "hr_access_denied",
      userId: userResult.user.id,
      entityId,
      houseId,
      details: { allowedByPolicy: hrAccess.allowedByPolicy, allowedByRole: hrAccess.allowedByRole },
    });
    return jsonError(403, "Not allowed");
  }

  const employeesResult = await listEmployeesByHouse(authed, houseId, {}, { allowedBranchIds: branchIds });
  if (employeesResult.error) {
    logApiError({
      route: ROUTE_NAME,
      action: "list_employees",
      userId: userResult.user.id,
      entityId,
      houseId,
      error: employeesResult.error,
      details: { branchCount: branchIds.length },
    });
    return jsonError(500, "Failed to load employees", { message: employeesResult.error });
  }

  return jsonOk({ employees: employeesResult.employees });
}
