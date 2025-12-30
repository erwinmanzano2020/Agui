import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { EmployeeAccessError } from "@/lib/hr/employees";
import type { Database, EmployeeRow, EmployeeInsert } from "@/lib/db.types";
import { getIdentitySummariesForEmployees, type IdentitySummary } from "@/lib/hr/employee-identity";
import type { HrAccessDecision } from "./access";
import type { EmployeeListFilters } from "./employees";

function logIdentityError(context: string, error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code ?? null
      : null;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[employees] identity lookup failed (${context})`, { code, message });
}

export type EmployeeListItem = {
  id: string;
  house_id: string;
  code: string;
  entity_id: string | null;
  full_name: string;
  status: EmployeeRow["status"];
  branch_id: string | null;
  branch_name: string | null;
  rate_per_day: number;
  identity?: IdentitySummary | null;
  identity_unavailable?: boolean;
};

export type EmployeeListResult = { employees: EmployeeListItem[]; error?: string };

export type BranchListItem = { id: string; name: string };
export type BranchListResult = { branches: BranchListItem[]; error?: string };

export type EmployeeProfile = {
  id: string;
  house_id: string;
  code: string;
  entity_id: string | null;
  full_name: string;
  status: EmployeeRow["status"];
  branch_id: string | null;
  branch_name: string | null;
  rate_per_day: number;
  created_at: string;
  identity?: IdentitySummary | null;
  identity_unavailable?: boolean;
};

export type EmployeeUpdateInput = {
  full_name: string;
  status: EmployeeRow["status"];
  branch_id: string | null;
  rate_per_day: number;
};

export class EmployeeUpdateError extends Error {}
export class EmployeeCreateError extends Error {}
export class EmployeeDuplicateIdentityError extends EmployeeCreateError {
  constructor(
    message: string,
    public employeeId?: string | null,
    public employeeCode?: string | null,
    public employeeName?: string | null,
  ) {
    super(message);
    this.name = "EmployeeDuplicateIdentityError";
  }
}

export type EmployeeCreateInput = {
  full_name: string;
  status?: EmployeeRow["status"];
  branch_id?: string | null;
  entity_id?: string | null;
  rate_per_day: number;
};

export async function listBranchesForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
): Promise<BranchListResult> {
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, house_id")
    .eq("house_id", houseId)
    .order("name", { ascending: true });

  const rows = (data ?? [])
    .filter((row) => (row as { house_id?: string | null }).house_id === houseId)
    .map((row) => {
      const id = (row as { id?: string | null }).id;
      const name = (row as { name?: string | null }).name;
      return id ? ({ id, name: name ?? "" } as BranchListItem) : null;
    })
    .filter((row): row is BranchListItem => Boolean(row));

  if (error) {
    console.error("Failed to load branches", error);
    return { branches: rows, error: error.message } satisfies BranchListResult;
  }

  return { branches: rows } satisfies BranchListResult;
}

export async function listEmployeesByHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  filters: EmployeeListFilters = {},
  options: { allowedBranchIds?: string[]; branchNames?: Record<string, string>; includeIdentity?: boolean } = {},
): Promise<EmployeeListResult> {
  const allowedBranches = options.allowedBranchIds ?? null;
  if (filters.branchId && allowedBranches && !allowedBranches.includes(filters.branchId)) {
    return { employees: [] } satisfies EmployeeListResult;
  }

  let query = supabase
    .from("employees")
    .select("id, house_id, code, entity_id, full_name, status, branch_id, rate_per_day")
    .eq("house_id", houseId);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.branchId) {
    query = query.eq("branch_id", filters.branchId);
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`full_name.ilike.${term},code.ilike.${term}`);
  }

  const { data, error } = await query.order("full_name", { ascending: true });
  const branchNameLookup = options.branchNames ?? {};

  const employees: EmployeeListItem[] = (data ?? []).map((row) => {
    const employee = row as EmployeeRow;
    const branchId = employee.branch_id ?? null;
    return {
      id: employee.id,
      house_id: employee.house_id,
      code: employee.code,
      entity_id: employee.entity_id ?? null,
      full_name: employee.full_name,
      status: employee.status,
      branch_id: branchId,
      branch_name: branchId ? branchNameLookup[branchId] ?? null : null,
      rate_per_day: Number(employee.rate_per_day ?? 0),
    } satisfies EmployeeListItem;
  });

  if (options.includeIdentity) {
    const entityIds = employees.map((emp) => emp.entity_id).filter((id): id is string => Boolean(id));
    try {
      const summaries = await getIdentitySummariesForEmployees(supabase, { houseId, entityIds });
      const map = new Map(summaries.map((item) => [item.entityId, item]));
      employees.forEach((emp) => {
        emp.identity = emp.entity_id ? map.get(emp.entity_id) ?? null : null;
      });
    } catch (lookupError) {
      logIdentityError("list", lookupError);
      employees.forEach((emp) => {
        emp.identity_unavailable = true;
      });
    }
  }

  if (error) {
    console.error("Failed to load employees", error);
    return { employees, error: error.message } satisfies EmployeeListResult;
  }

  return { employees } satisfies EmployeeListResult;
}

type BranchLookupRow = { id?: string | null; house_id?: string | null; name?: string | null };

type EmployeeWithBranch = EmployeeRow & {
  branches?: BranchLookupRow | null;
};

export async function getEmployeeByIdForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeId: string,
  options: { includeIdentity?: boolean } = {},
): Promise<EmployeeProfile | null> {
  const { data } = await supabase
    .from("employees")
    .select(
      "id, house_id, code, entity_id, full_name, status, branch_id, rate_per_day, created_at, branches(id, name, house_id)",
    )
    .eq("house_id", houseId)
    .eq("id", employeeId)
    .maybeSingle<EmployeeWithBranch>();

  if (!data) {
    return null;
  }

  const employee = data;
  const branch = employee.branches ?? null;
  const branchBelongsToHouse = Boolean(branch && branch.id && branch.house_id === houseId);

  let branchId: string | null = null;
  let branchName: string | null = null;
  let identity: IdentitySummary | null = null;
  let identityUnavailable = false;

  if (branchBelongsToHouse && branch) {
    branchId = branch.id ?? null;
    branchName = branch.name ?? null;
  }

  if (options.includeIdentity && employee.entity_id) {
    try {
      const summaries = await getIdentitySummariesForEmployees(supabase, {
        houseId,
        entityIds: [employee.entity_id],
      });
      identity = summaries[0] ?? null;
    } catch (lookupError) {
      logIdentityError("detail", lookupError);
      identityUnavailable = true;
    }
  }

  return {
    id: employee.id,
    house_id: employee.house_id,
    code: employee.code,
    entity_id: employee.entity_id ?? null,
    full_name: employee.full_name,
    status: employee.status,
    branch_id: branchId,
    branch_name: branchName,
    rate_per_day: Number(employee.rate_per_day ?? 0),
    created_at: employee.created_at,
    identity,
    identity_unavailable: identityUnavailable,
  } satisfies EmployeeProfile;
}

async function ensureBranchInHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  branchId: string,
): Promise<BranchLookupRow> {
  const { data, error } = await supabase
    .from("branches")
    .select("id, house_id, name")
    .eq("id", branchId)
    .maybeSingle<BranchLookupRow>();

  if (error) {
    throw new Error(error.message);
  }

  const branch = data ?? null;
  if (!branch || !branch.id || branch.house_id !== houseId) {
    throw new EmployeeUpdateError("Branch does not belong to this house");
  }

  return branch;
}

export async function updateEmployeeForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeId: string,
  patch: EmployeeUpdateInput,
): Promise<EmployeeProfile | null> {
  const { data: existing, error: existingError } = await supabase
    .from("employees")
    .select("id, house_id, code")
    .eq("id", employeeId)
    .maybeSingle<EmployeeRow>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existing || existing.house_id !== houseId) {
    return null;
  }

  if (patch.branch_id) {
    await ensureBranchInHouse(supabase, houseId, patch.branch_id);
  }

  const updates: Partial<EmployeeRow> = {
    full_name: patch.full_name,
    status: patch.status,
    branch_id: patch.branch_id,
    rate_per_day: patch.rate_per_day,
  };

  const { data, error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", employeeId)
    .eq("house_id", houseId)
    .select(
      "id, house_id, code, entity_id, full_name, status, branch_id, rate_per_day, created_at, branches(id, name, house_id)",
    )
    .maybeSingle<EmployeeWithBranch>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const branchBelongsToHouse = Boolean(
    data.branches && data.branches.id && data.branches.house_id === houseId,
  );

  const branchId = branchBelongsToHouse ? data.branches?.id ?? null : null;
  const branchName = branchBelongsToHouse ? data.branches?.name ?? null : null;

  return {
    id: data.id,
    house_id: data.house_id,
    code: data.code,
    entity_id: data.entity_id ?? null,
    full_name: data.full_name,
    status: data.status,
    branch_id: branchId,
    branch_name: branchName,
    rate_per_day: Number(data.rate_per_day ?? 0),
    created_at: data.created_at,
  } satisfies EmployeeProfile;
}

export async function updateEmployeeForHouseWithAccess(
  supabase: SupabaseClient<Database>,
  access: HrAccessDecision,
  houseId: string,
  employeeId: string,
  patch: EmployeeUpdateInput,
): Promise<EmployeeProfile | null> {
  if (!access.allowed || !access.hasWorkspaceAccess) {
    throw new EmployeeAccessError("Not allowed to update employees for this house");
  }

  return updateEmployeeForHouse(supabase, houseId, employeeId, patch);
}

function assertHrCreateAccess(access: HrAccessDecision) {
  if (!access.allowed || !access.hasWorkspaceAccess) {
    throw new EmployeeAccessError("Not allowed to create employees for this house");
  }
}

export async function createEmployeeForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  payload: EmployeeCreateInput,
): Promise<EmployeeProfile> {
  if (!houseId?.trim()) {
    throw new EmployeeCreateError("house_id is required for employee creation");
  }

  const branchId = payload.branch_id?.trim() || null;
  if (branchId) {
    await ensureBranchInHouse(supabase, houseId, branchId);
  }

  const entityId = payload.entity_id?.trim() || null;
  if (entityId) {
    const { data: existing, error: existingError } = await supabase
      .from("employees")
      .select("id, status, code, full_name")
      .eq("house_id", houseId)
      .eq("entity_id", entityId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle<EmployeeRow>();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      throw new EmployeeDuplicateIdentityError(
        "An active employee with this identity already exists in this house.",
        existing.id,
        (existing as EmployeeRow & { code?: string }).code ?? null,
        (existing as EmployeeRow & { full_name?: string }).full_name ?? null,
      );
    }
  }

  const insert: EmployeeInsert = {
    house_id: houseId,
    full_name: payload.full_name,
    status: payload.status ?? "active",
    branch_id: branchId,
    entity_id: entityId,
    rate_per_day: payload.rate_per_day,
  };

  const { data, error } = await supabase
    .from("employees")
    .insert(insert)
    .select(
      "id, house_id, code, entity_id, full_name, status, branch_id, rate_per_day, created_at, branches(id, name, house_id)",
    )
    .maybeSingle<EmployeeWithBranch>();

  if (error) {
    throw new EmployeeCreateError(error.message);
  }

  if (!data) {
    throw new EmployeeCreateError("Employee was not created");
  }

  const branchBelongsToHouse = Boolean(data.branches && data.branches.id && data.branches.house_id === houseId);

  return {
    id: data.id,
    house_id: data.house_id,
    code: data.code,
    entity_id: data.entity_id ?? null,
    full_name: data.full_name,
    status: data.status,
    branch_id: branchBelongsToHouse ? data.branches?.id ?? null : null,
    branch_name: branchBelongsToHouse ? data.branches?.name ?? null : null,
    rate_per_day: Number(data.rate_per_day ?? 0),
    created_at: data.created_at,
  } satisfies EmployeeProfile;
}

export async function createEmployeeForHouseWithAccess(
  supabase: SupabaseClient<Database>,
  access: HrAccessDecision,
  houseId: string,
  payload: EmployeeCreateInput,
): Promise<EmployeeProfile> {
  assertHrCreateAccess(access);
  return createEmployeeForHouse(supabase, houseId, payload);
}
