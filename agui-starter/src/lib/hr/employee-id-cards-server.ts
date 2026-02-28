import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import type { EmployeeIdCardRow } from "@/lib/hr/employee-id-cards";

export async function listEmployeeIdCards(
  supabase: SupabaseClient<Database>,
  houseId: string,
  filters: { branchId?: string | null; search?: string } = {},
): Promise<EmployeeIdCardRow[]> {
  let query = supabase
    .from("employees")
    .select("id, code, full_name, position_title, house_id, branch_id")
    .eq("house_id", houseId)
    .eq("status", "active");

  if (filters.branchId) {
    query = query.eq("branch_id", filters.branchId);
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.ilike("code", term);
  }

  const [{ data: employees, error }, { data: house }, { data: branches }] = await Promise.all([
    query.order("code", { ascending: true }),
    supabase.from("houses").select("id, name, logo_url").eq("id", houseId).maybeSingle(),
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
    houseLogoUrl: house?.logo_url ?? null,
  }));
}

export async function getEmployeeIdCardById(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeId: string,
): Promise<EmployeeIdCardRow | null> {
  const [{ data: employee, error }, { data: house }, { data: branch }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, code, full_name, position_title, house_id, branch_id")
      .eq("id", employeeId)
      .eq("house_id", houseId)
      .maybeSingle(),
    supabase.from("houses").select("id, name, logo_url").eq("id", houseId).maybeSingle(),
    supabase
      .from("employees")
      .select("branches(name)")
      .eq("id", employeeId)
      .eq("house_id", houseId)
      .maybeSingle<{ branches?: { name?: string | null } | null }>(),
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
    houseLogoUrl: house?.logo_url ?? null,
  };
}
