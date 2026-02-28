import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import type { EmployeeIdCardRow } from "@/lib/hr/employee-id-cards";

type EmploymentLite = {
  entity_id: string | null;
  role_id: string | null;
  status: string;
};

type RoleLite = {
  id: string;
  label: string | null;
  slug: string;
};

function normalizePosition(role: RoleLite | undefined): string | null {
  if (role?.label?.trim()) {
    return role.label.trim();
  }
  if (role?.slug?.trim()) {
    return role.slug
      .trim()
      .split(/[_-]+/)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  }
  return null;
}

async function getEmployeeMetadata(
  supabase: SupabaseClient<Database>,
  houseId: string,
  entityIds: string[],
): Promise<Map<string, { position: string | null; validUntil: string | null }>> {
  const byEntity = new Map<string, { position: string | null; validUntil: string | null }>();
  if (entityIds.length === 0) {
    return byEntity;
  }

  const { data: employments, error: employmentError } = await supabase
    .from("employments")
    .select("entity_id, role_id, status")
    .eq("business_id", houseId)
    .in("entity_id", entityIds);

  if (employmentError) {
    throw new Error(employmentError.message);
  }

  const active = ((employments ?? []) as EmploymentLite[]).filter((employment) => employment.entity_id);
  const roleIds = Array.from(new Set(active.map((employment) => employment.role_id).filter((id): id is string => Boolean(id))));

  const roleById = new Map<string, RoleLite>();
  if (roleIds.length > 0) {
    const { data: roles, error: roleError } = await supabase
      .from("roles")
      .select("id, label, slug")
      .in("id", roleIds);
    if (roleError) {
      throw new Error(roleError.message);
    }
    for (const role of (roles ?? []) as RoleLite[]) {
      roleById.set(role.id, role);
    }
  }

  for (const employment of active) {
    if (!employment.entity_id || byEntity.has(employment.entity_id)) {
      continue;
    }
    byEntity.set(employment.entity_id, {
      position: normalizePosition(employment.role_id ? roleById.get(employment.role_id) : undefined),
      validUntil: employment.status === "active" ? null : null,
    });
  }

  return byEntity;
}

export async function listEmployeeIdCards(
  supabase: SupabaseClient<Database>,
  houseId: string,
  filters: { branchId?: string | null; search?: string } = {},
): Promise<EmployeeIdCardRow[]> {
  let query = supabase
    .from("employees")
    .select("id, code, full_name, house_id, branch_id, entity_id")
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
  const entityIds = Array.from(new Set((employees ?? []).map((employee) => employee.entity_id).filter((id): id is string => Boolean(id))));
  const metadataByEntityId = await getEmployeeMetadata(supabase, houseId, entityIds);

  return (employees ?? []).map((employee) => {
    const metadata = employee.entity_id ? metadataByEntityId.get(employee.entity_id) : undefined;
    return {
      id: employee.id,
      code: employee.code,
      fullName: employee.full_name ?? null,
      position: metadata?.position ?? null,
      branchName: employee.branch_id ? branchNames.get(employee.branch_id) ?? null : null,
      validUntil: metadata?.validUntil ?? null,
      houseId,
      houseName: house?.name ?? "House",
      houseLogoUrl: house?.logo_url ?? null,
    };
  });
}

export async function getEmployeeIdCardById(
  supabase: SupabaseClient<Database>,
  houseId: string,
  employeeId: string,
): Promise<EmployeeIdCardRow | null> {
  const [{ data: employee, error }, { data: house }, { data: branch }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, code, full_name, house_id, branch_id, entity_id")
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

  const metadataByEntityId = await getEmployeeMetadata(supabase, houseId, employee.entity_id ? [employee.entity_id] : []);
  const metadata = employee.entity_id ? metadataByEntityId.get(employee.entity_id) : undefined;

  return {
    id: employee.id,
    code: employee.code,
    fullName: employee.full_name ?? null,
    position: metadata?.position ?? null,
    branchName: branch?.branches?.name ?? null,
    validUntil: metadata?.validUntil ?? null,
    houseId,
    houseName: house?.name ?? "House",
    houseLogoUrl: house?.logo_url ?? null,
  };
}
