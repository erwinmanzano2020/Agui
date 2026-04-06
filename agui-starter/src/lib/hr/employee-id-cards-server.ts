import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import type { EmployeeIdCardRow } from "@/lib/hr/employee-id-cards";
import { normalizeEmployeePhotoUrl } from "@/lib/hr/employee-id-cards";

export async function listEmployeeIdCards(
  supabase: SupabaseClient<Database>,
  houseId: string,
  filters: { branchId?: string | null; search?: string } = {},
  options: { readScope?: { isBranchLimited?: boolean; allowedBranchIds?: string[] } } = {},
): Promise<EmployeeIdCardRow[]> {
  const readScope = options.readScope ?? {};
  const isBranchLimited = readScope.isBranchLimited === true;
  const allowedBranchIds = readScope.allowedBranchIds ?? [];

  if (filters.branchId && isBranchLimited && !allowedBranchIds.includes(filters.branchId)) {
    return [];
  }
  if (isBranchLimited && allowedBranchIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("employees")
    .select("id, code, full_name, position_title, photo_url, house_id, branch_id")
    .eq("house_id", houseId)
    .eq("status", "active");

  if (filters.branchId) {
    query = query.eq("branch_id", filters.branchId);
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.ilike("code", term);
  }

  if (isBranchLimited) {
    query = query.in("branch_id", allowedBranchIds);
  }

  const [{ data: employees, error }, { data: house }, { data: branches }] = await Promise.all([
    query.order("code", { ascending: true }),
    supabase.from("houses").select("id, name, brand_name, logo_url").eq("id", houseId).maybeSingle(),
    supabase.from("branches").select("id, name").eq("house_id", houseId),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const branchNames = new Map((branches ?? []).map((branch) => [branch.id, branch.name ?? null]));

  return (employees ?? []).map((employee) => ({
    id: employee.id,
    code: employee.code,
    fullName: employee.full_name ?? null,
    position: employee.position_title ?? null,
    branchName: employee.branch_id ? branchNames.get(employee.branch_id) ?? null : null,
    validUntil: null,
    houseId,
    houseName: house?.name ?? "",
    houseBrandName: house?.brand_name ?? null,
    houseLogoUrl: house?.logo_url ?? null,
    photoUrl: normalizeEmployeePhotoUrl(employee.photo_url),
  }));
}

export async function getEmployeeIdCardById(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeId: string,
  options: { readScope?: { isBranchLimited?: boolean; allowedBranchIds?: string[] } } = {},
): Promise<EmployeeIdCardRow | null> {
  const readScope = options.readScope ?? {};
  const isBranchLimited = readScope.isBranchLimited === true;
  const allowedBranchIds = readScope.allowedBranchIds ?? [];
  if (isBranchLimited && allowedBranchIds.length === 0) {
    return null;
  }

  let employeeQuery = supabase
    .from("employees")
    .select("id, code, full_name, position_title, photo_url, house_id, branch_id")
    .eq("id", employeeId)
    .eq("house_id", houseId);
  let branchQuery = supabase
    .from("employees")
    .select("branches(name)")
    .eq("id", employeeId)
    .eq("house_id", houseId);

  if (isBranchLimited) {
    employeeQuery = employeeQuery.in("branch_id", allowedBranchIds);
    branchQuery = branchQuery.in("branch_id", allowedBranchIds);
  }

  const [{ data: employee, error }, { data: house }, { data: branch }] = await Promise.all([
    employeeQuery.maybeSingle(),
    supabase.from("houses").select("id, name, brand_name, logo_url").eq("id", houseId).maybeSingle(),
    branchQuery.maybeSingle<{ branches?: { name?: string | null } | null }>(),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  if (!employee) {
    return null;
  }

  return {
    id: employee.id,
    code: employee.code,
    fullName: employee.full_name ?? null,
    position: employee.position_title ?? null,
    branchName: branch?.branches?.name ?? null,
    validUntil: null,
    houseId,
    houseName: house?.name ?? "",
    houseBrandName: house?.brand_name ?? null,
    houseLogoUrl: house?.logo_url ?? null,
    photoUrl: normalizeEmployeePhotoUrl(employee.photo_url),
  };
}
