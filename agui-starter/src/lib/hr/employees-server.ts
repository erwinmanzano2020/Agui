import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { EmployeeAccessError } from "@/lib/hr/employees";
import type { Database, EmployeeRow } from "@/lib/db.types";
import type { HrAccessDecision } from "./access";
import type { EmployeeListFilters } from "./employees";

export type EmployeeListItem = {
  id: string;
  house_id: string;
  code: string;
  full_name: string;
  status: EmployeeRow["status"];
  branch_id: string | null;
  branch_name: string | null;
  rate_per_day: number;
  display_name: string;
};

export type BranchListItem = { id: string; name: string };
export type BranchListResult = { branches: BranchListItem[]; error?: string };

export type EmployeeProfile = {
  id: string;
  house_id: string;
  code: string;
  full_name: string;
  status: EmployeeRow["status"];
  branch_id: string | null;
  branch_name: string | null;
  rate_per_day: number;
  created_at: string;
};

export type EmployeeUpdateInput = {
  full_name: string;
  status: EmployeeRow["status"];
  branch_id: string | null;
  rate_per_day: number;
};

export class EmployeeUpdateError extends Error {}

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
  options: { allowedBranchIds?: string[]; branchNames?: Record<string, string> } = {},
): Promise<EmployeeListItem[]> {
  const allowedBranches = options.allowedBranchIds ?? null;
  if (filters.branchId && allowedBranches && !allowedBranches.includes(filters.branchId)) {
    return [];
  }

  let query = supabase
    .from("employees")
    .select("id, house_id, code, full_name, status, branch_id, rate_per_day")
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

  const { data } = await query.order("full_name", { ascending: true }).throwOnError();
  const branchNameLookup = options.branchNames ?? {};

  return (data ?? []).map((row) => {
    const employee = row as EmployeeRow;
    const branchId = employee.branch_id ?? null;
    return {
      id: employee.id,
      house_id: employee.house_id,
      code: employee.code,
      full_name: employee.full_name,
      status: employee.status,
      branch_id: branchId,
      branch_name: branchId ? branchNameLookup[branchId] ?? null : null,
      rate_per_day: Number(employee.rate_per_day ?? 0),
      display_name: employee.full_name,
    } satisfies EmployeeListItem;
  });
}

type BranchLookupRow = { id?: string | null; house_id?: string | null; name?: string | null };

type EmployeeWithBranch = EmployeeRow & {
  branches?: BranchLookupRow | null;
};

export async function getEmployeeByIdForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeId: string,
): Promise<EmployeeProfile | null> {
  const { data } = await supabase
    .from("employees")
    .select(
      "id, house_id, code, full_name, status, branch_id, rate_per_day, created_at, branches(id, name, house_id)",
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

  if (branchBelongsToHouse && branch) {
    branchId = branch.id ?? null;
    branchName = branch.name ?? null;
  }

  return {
    id: employee.id,
    house_id: employee.house_id,
    code: employee.code,
    full_name: employee.full_name,
    status: employee.status,
    branch_id: branchId,
    branch_name: branchName,
    rate_per_day: Number(employee.rate_per_day ?? 0),
    created_at: employee.created_at,
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
    display_name: patch.full_name,
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
      "id, house_id, code, full_name, status, branch_id, rate_per_day, created_at, branches(id, name, house_id)",
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
