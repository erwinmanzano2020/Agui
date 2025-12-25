import { NextRequest, NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import {
  EmployeeCreateError,
  EmployeeUpdateError,
  createEmployeeForHouseWithAccess,
  listEmployeesByHouse,
} from "@/lib/hr/employees-server";
import { resolveHrAccess } from "@/lib/hr/access";
import {
  findOrCreateEntityForEmployee,
  normalizeEmployeeEmail,
  normalizeEmployeePhoneDetails,
} from "@/lib/hr/employee-identity";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CreateEmployeePayloadSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  branch_id: z.string().trim().uuid().optional(),
  rate_per_day: z.number().positive(),
  status: z.enum(["active", "inactive"]).default("active").optional(),
  email: z.string().trim().regex(EMAIL_REGEX).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9()[\]\s.-]{6,}$/)
    .optional(),
});

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

export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    logApiWarning({ route: ROUTE_NAME, action: "invalid_json", error });
    return jsonError(400, "Invalid JSON payload");
  }

  const normalizedPayload = {
    full_name: (body as Record<string, unknown> | null)?.full_name,
    branch_id:
      typeof (body as Record<string, unknown> | null)?.branch_id === "string" &&
      ((body as Record<string, unknown> | null)?.branch_id as string).trim()
        ? ((body as Record<string, unknown> | null)?.branch_id as string).trim()
        : undefined,
    rate_per_day:
      typeof (body as Record<string, unknown> | null)?.rate_per_day === "string"
        ? Number((body as Record<string, unknown> | null)?.rate_per_day)
        : (body as Record<string, unknown> | null)?.rate_per_day,
    status: (body as Record<string, unknown> | null)?.status,
    email:
      typeof (body as Record<string, unknown> | null)?.email === "string" &&
      ((body as Record<string, unknown> | null)?.email as string).trim()
        ? ((body as Record<string, unknown> | null)?.email as string).trim()
        : undefined,
    phone:
      typeof (body as Record<string, unknown> | null)?.phone === "string" &&
      ((body as Record<string, unknown> | null)?.phone as string).trim()
        ? ((body as Record<string, unknown> | null)?.phone as string).trim()
        : undefined,
  };

  const parsed = CreateEmployeePayloadSchema.safeParse(normalizedPayload);
  if (!parsed.success) {
    const details = parsed.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", { message: details[0] });
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

  const branchId = parsed.data.branch_id ?? null;
  if (branchId && !branchIds.includes(branchId)) {
    return jsonError(400, "Select a branch within this house", { fieldErrors: { branch_id: ["Invalid branch"] } });
  }

  const normalizedEmail = normalizeEmployeeEmail(parsed.data.email ?? null);
  if (parsed.data.email && !normalizedEmail) {
    return jsonError(400, "Fix the highlighted fields and try again.", { fieldErrors: { email: ["Enter a valid email"] } });
  }

  const normalizedPhone = normalizeEmployeePhoneDetails(parsed.data.phone ?? null);
  if (parsed.data.phone && !normalizedPhone) {
    return jsonError(400, "Fix the highlighted fields and try again.", {
      fieldErrors: { phone: ["Enter a valid phone number"] },
    });
  }

  let resolvedEntityId: string | null = null;
  try {
    const entityResult = await findOrCreateEntityForEmployee(authed, {
      houseId,
      fullName: parsed.data.full_name,
      email: normalizedEmail,
      phone: normalizedPhone?.e164 ?? null,
    });
    resolvedEntityId = entityResult.entityId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logApiError({
      route: ROUTE_NAME,
      action: "link_entity",
      userId: userResult.user.id,
      entityId,
      houseId,
      error: message,
    });
    if (message.toLowerCase().includes("not allowed")) {
      return jsonError(403, "Not allowed to link identity", { message });
    }
    return jsonError(500, "Failed to link employee identity");
  }

  try {
    const created = await createEmployeeForHouseWithAccess(authed, hrAccess, houseId, {
      full_name: parsed.data.full_name,
      branch_id: branchId,
      rate_per_day: parsed.data.rate_per_day,
      status: parsed.data.status ?? "active",
      entity_id: resolvedEntityId,
    });

    return NextResponse.json({ employee: created }, { status: 201 });
  } catch (error) {
    if (error instanceof EmployeeUpdateError) {
      return jsonError(400, "Select a branch within this house", { fieldErrors: { branch_id: ["Invalid branch"] } });
    }
    if (error instanceof EmployeeCreateError) {
      return jsonError(500, "Failed to create employee", { message: error.message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "create_employee",
      userId: userResult.user.id,
      entityId,
      houseId,
      error,
    });
    return jsonError(500, "Unexpected error while creating employee");
  }
}
