import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EmployeeRow } from "@/lib/db.types";
import { isOptionalTableError } from "@/lib/supabase/errors";

type EmployeeRowWithDepartment = EmployeeRow & { department_id?: string | null };

export type EmployeeListItem = {
  id: string;
  entity_id: string;
  code: string | null;
  full_name: string;
  status: string | null;
  rate_per_day: number | null;
};

function normalizeEmployee(row: EmployeeRowWithDepartment): EmployeeListItem {
  return {
    id: row.id,
    entity_id: row.entity_id,
    code: row.code ?? null,
    full_name: row.full_name ?? "",
    status: row.status ?? null,
    rate_per_day: row.rate_per_day ?? null,
  } satisfies EmployeeListItem;
}

export async function listEmployeesForHouse(
  supabase: SupabaseClient<Database>,
  departmentIds: string[],
): Promise<EmployeeListItem[]> {
  if (!departmentIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id, entity_id, code, full_name, status, rate_per_day")
    // department_id is the scoped link for employees in the starter schema
    .in("department_id" as never, departmentIds)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as EmployeeRowWithDepartment[]).map(normalizeEmployee);
}

export async function listDepartmentIdsForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
): Promise<string[]> {
  const tables = ["departments", "branches"] as const;

  for (const table of tables) {
    const { data, error } = await supabase.from(table as never).select("id").eq("house_id", houseId);

    if (error) {
      if (isOptionalTableError(error)) {
        continue;
      }
      throw new Error(error.message);
    }

    const ids = (data ?? [])
      .map((row) => (row as { id?: string | null }).id)
      .filter((id): id is string => Boolean(id));

    if (ids.length > 0) {
      return ids;
    }
  }

  return [];
}
