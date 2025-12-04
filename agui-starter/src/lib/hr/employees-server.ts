import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EmployeeRow } from "@/lib/db.types";

type EmployeeRowWithHouse = EmployeeRow & { house_id?: string | null };

export type EmployeeListItem = {
  id: string;
  code: string | null;
  full_name: string;
  status: string | null;
  rate_per_day: number | null;
};

function normalizeEmployee(row: EmployeeRowWithHouse): EmployeeListItem {
  return {
    id: row.id,
    code: row.code ?? null,
    full_name: row.full_name ?? "",
    status: row.status ?? null,
    rate_per_day: row.rate_per_day ?? null,
  } satisfies EmployeeListItem;
}

export async function listEmployeesForHouse(
  supabase: SupabaseClient<Database>,
  houseId: string,
): Promise<EmployeeListItem[]> {
  if (!houseId) {
    throw new Error("houseId is required");
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id, code, full_name, status, rate_per_day")
    // house_id is present on the table even if older generated types omit it
    .eq("house_id" as never, houseId)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as EmployeeRowWithHouse[]).map(normalizeEmployee);
}
