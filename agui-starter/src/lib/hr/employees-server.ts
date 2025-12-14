import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EmployeeRow } from "@/lib/db.types";

export type EmployeeListItem = {
  id: string;
  display_name: string;
  status: EmployeeRow["status"];
  employment_type: EmployeeRow["employment_type"];
  branch_id: string | null;
};

function normalizeEmployee(row: EmployeeRow): EmployeeListItem {
  return {
    id: row.id,
    display_name: row.display_name,
    status: row.status,
    employment_type: row.employment_type,
    branch_id: row.branch_id,
  } satisfies EmployeeListItem;
}

export async function listEmployeesForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
  branchIds?: string[],
): Promise<EmployeeListItem[]> {
  if (branchIds && branchIds.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("employees")
    .select("id, display_name, status, employment_type, branch_id, house_id")
    .eq("house_id", houseId)
    .order("display_name", { ascending: true })
    .throwOnError();

  let rows = (data ?? []) as EmployeeRow[];
  if (branchIds && branchIds.length) {
    rows = rows.filter((row) => row.branch_id && branchIds.includes(row.branch_id));
  }

  return rows.map(normalizeEmployee);
}
