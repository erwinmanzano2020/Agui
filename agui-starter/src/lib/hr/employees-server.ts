import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EmployeeRow } from "@/lib/db.types";
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
  employment_type: EmployeeRow["employment_type"];
  display_name: string;
};

export type BranchListItem = { id: string; name: string };

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

export async function listBranchesForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
): Promise<BranchListItem[]> {
  const { data } = await supabase
    .from("branches")
    .select("id, name")
    .eq("house_id", houseId)
    .order("name", { ascending: true })
    .throwOnError();

  return (data ?? [])
    .map((row) => {
      const id = (row as { id?: string | null }).id;
      const name = (row as { name?: string | null }).name;
      return id ? ({ id, name: name ?? "" } as BranchListItem) : null;
    })
    .filter((row): row is BranchListItem => Boolean(row));
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
    .select("id, house_id, code, full_name, status, branch_id, rate_per_day, employment_type")
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
      employment_type: employee.employment_type,
      display_name: employee.full_name,
    } satisfies EmployeeListItem;
  });
}

type EmployeeWithBranch = EmployeeRow & {
  branches?: { id?: string | null; name?: string | null; house_id?: string | null } | null;
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
