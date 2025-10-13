import { SupabaseClient } from "@supabase/supabase-js";

export interface DtrWithRates {
  dtr_id: string | number;
  employee_id: string | number;
  work_date: string; // YYYY-MM-DD
  hourly_rate: number | null;
  daily_rate: number | null;
  semi_monthly_rate: number | null;
  monthly_rate: number | null;
}

export async function fetchDtrWithRates(
  db: SupabaseClient,
  params: { employeeId?: string | number; from: string; to: string },
): Promise<DtrWithRates[]> {
  let q = db
    .from("dtr_with_rates")
    .select("*")
    .gte("work_date", params.from)
    .lte("work_date", params.to)
    .order("work_date", { ascending: true });

  if (params.employeeId !== undefined) {
    q = q.eq("employee_id", params.employeeId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DtrWithRates[];
}
