import { NextRequest, NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import {
  EmployeeBranchNotFoundError,
  EmployeeBranchRequiredError,
  EmployeeCreateError,
  EmployeeDuplicateIdentityError,
  EmployeeUpdateError,
  createEmployeeForHouseWithAccess,
  listEmployeesByHouse,
  resolveEmployeeCreateBranchForHouseWithAccess,
} from "@/lib/hr/employees-server";
import { DUPLICATE_ACTIVE_EMPLOYEE_MESSAGE, EmployeeAccessError } from "@/lib/hr/employees";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
import {
  findOrCreateEntityForEmployee,
  normalizeEmployeeEmail,
  normalizeEmployeePhoneDetails,
} from "@/lib/hr/employee-identity";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CreateEmployeePayloadSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  branch_id: z.string().trim().uuid(),
  rate_per_day: z.number().positive(),
  position_title: z.string().trim().max(120).optional(),
  status: z.enum(["active", "inactive"]).default("active").optional(),
  email: z.string().trim().regex(EMAIL_REGEX).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9()[\]\s.-]{6,}$/)
    .optional(),
  entity_id: z.string().trim().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK],
    onUnauthenticated: () => jsonError(401, "Not authenticated"),
    onEntityNotLinked: () => jsonError(403, "Account not linked"),
  });
  if (actor instanceof NextResponse) {
    return actor;
  }

  const { supabase: authed, entityId, userId } = actor;

  const url = new URL(req.url);
  const requestedHouseId = url.searchParams.get("houseId");

  let houseId: string | null = null;
  try {
    houseId = await resolveHouseForEntity(authed, entityId, requestedHouseId);
  } catch (error) {
    logApiError({
      route: ROUTE_NAME,
      action: "resolve_house",
      userId,
      entityId,
      error,
    });
    return jsonError(500, "Failed to resolve house");
  }

  if (!houseId) {
    logApiWarning({
      route: ROUTE_NAME,
      action: "no_accessible_house",
      userId,
      entityId,
    });
    return jsonError(403, "No accessible house");
  }

  const hrAccess = await requireHrAccessWithBranch(authed, { houseId });
  if (!hrAccess.allowed) {
    logApiWarning({
      route: ROUTE_NAME,
      action: "hr_access_denied",
      userId,
      entityId,
      houseId,
      details: { allowedByPolicy: hrAccess.allowedByPolicy, allowedByRole: hrAccess.allowedByRole },
    });
    return jsonError(403, "Not allowed");
  }

  const employeesResult = await listEmployeesByHouse(authed, houseId, {}, {
    readScope: {
      isBranchLimited: hrAccess.isBranchLimited,
      allowedBranchIds: hrAccess.allowedBranchIds,
    },
    includeIdentity: true,
  });
  if (employeesResult.error) {
    logApiError({
      route: ROUTE_NAME,
      action: "list_employees",
      userId,
      entityId,
      houseId,
      error: employeesResult.error,
      details: { branchCount: hrAccess.allowedBranchIds.length, branchLimited: hrAccess.isBranchLimited },
    });
    return jsonError(500, "Failed to load employees", { message: employeesResult.error });
  }

  return jsonOk({ employees: employeesResult.employees });
}

export async function POST(req: NextRequest) {
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK],
    onUnauthenticated: () => jsonError(401, "Not authenticated"),
    onEntityNotLinked: () => jsonError(403, "Account not linked"),
  });
  if (actor instanceof NextResponse) {
    return actor;
  }

  const { supabase: authed, entityId, userId } = actor;

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
    position_title:
      typeof (body as Record<string, unknown> | null)?.position_title === "string" &&
      ((body as Record<string, unknown> | null)?.position_title as string).trim()
        ? ((body as Record<string, unknown> | null)?.position_title as string).trim()
        : undefined,
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
    entity_id:
      typeof (body as Record<string, unknown> | null)?.entity_id === "string" &&
      ((body as Record<string, unknown> | null)?.entity_id as string).trim()
        ? ((body as Record<string, unknown> | null)?.entity_id as string).trim()
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
      userId,
      entityId,
      error,
    });
    return jsonError(500, "Failed to resolve house");
  }

  if (!houseId) {
    logApiWarning({
      route: ROUTE_NAME,
      action: "no_accessible_house",
      userId,
      entityId,
    });
    return jsonError(403, "No accessible house");
  }

  const hrAccess = await requireHrAccessWithBranch(authed, {
    houseId,
    requiredLevel: "write",
  });
  if (!hrAccess.allowed) {
    logApiWarning({
      route: ROUTE_NAME,
      action: "hr_access_denied",
      userId,
      entityId,
      houseId,
      details: { allowedByPolicy: hrAccess.allowedByPolicy, allowedByRole: hrAccess.allowedByRole },
    });
    return jsonError(403, "Not allowed");
  }

  const branchId = parsed.data.branch_id;
  let validatedBranchId: string;
  try {
    validatedBranchId = await resolveEmployeeCreateBranchForHouseWithAccess(authed, hrAccess, houseId, branchId);
  } catch (error) {
    if (error instanceof EmployeeAccessError) {
      return jsonError(403, "Not allowed");
    }
    if (error instanceof EmployeeBranchRequiredError) {
      return jsonError(400, "Fix the highlighted fields and try again.", {
        fieldErrors: { branch_id: ["Branch is required"] },
      });
    }
    if (error instanceof EmployeeBranchNotFoundError) {
      return jsonError(404, "Branch not found", { fieldErrors: { branch_id: ["Branch not found"] } });
    }
    if (error instanceof EmployeeCreateError) {
      return jsonError(500, "Failed to create employee", { message: error.message });
    }
    logApiError({
      route: ROUTE_NAME,
      action: "create_employee_branch_gate",
      userId,
      entityId,
      houseId,
      error,
    });
    return jsonError(500, "Unexpected error while creating employee");
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

  let resolvedEntityId: string | null = parsed.data.entity_id ?? null;
  if (!resolvedEntityId) {
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
        userId,
        entityId,
        houseId,
        error: message,
      });
      if (message.toLowerCase().includes("schema")) {
        return jsonError(
          503,
          "Identity service unavailable: run latest migrations and reload PostgREST schema.",
          { message },
        );
      }
      if (message.toLowerCase().includes("not allowed")) {
        return jsonError(403, "Not allowed to link identity", { message });
      }
      return jsonError(503, "Identity service is unavailable right now. Please retry the lookup.", { message });
    }
  }

  try {
    const created = await createEmployeeForHouseWithAccess(authed, hrAccess, houseId, {
      full_name: parsed.data.full_name,
      branch_id: validatedBranchId,
      rate_per_day: parsed.data.rate_per_day,
      status: parsed.data.status ?? "active",
      entity_id: resolvedEntityId,
      position_title: parsed.data.position_title?.trim() || null,
    });

    return NextResponse.json({ employee: created }, { status: 201 });
  } catch (error) {
    if (error instanceof EmployeeAccessError) {
      return jsonError(403, "Not allowed");
    }
    if (error instanceof EmployeeBranchRequiredError) {
      return jsonError(400, "Fix the highlighted fields and try again.", {
        fieldErrors: { branch_id: ["Branch is required"] },
      });
    }
    if (error instanceof EmployeeBranchNotFoundError) {
      return jsonError(404, "Branch not found", { fieldErrors: { branch_id: ["Branch not found"] } });
    }
    if (error instanceof EmployeeUpdateError) {
      return jsonError(400, "Select a branch within this house", { fieldErrors: { branch_id: ["Invalid branch"] } });
    }
    if (error instanceof EmployeeDuplicateIdentityError) {
      return jsonError(409, DUPLICATE_ACTIVE_EMPLOYEE_MESSAGE, {
        message: error.message,
        existing_employee_id: error.employeeId,
        existing_employee_code: error.employeeCode,
        existing_employee_name: error.employeeName,
      });
    }
    if (error instanceof EmployeeCreateError) {
      return jsonError(500, "Failed to create employee", { message: error.message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "create_employee",
      userId,
      entityId,
      houseId,
      error,
    });
    return jsonError(500, "Unexpected error while creating employee");
  }
}
