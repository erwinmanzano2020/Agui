import { SupabaseClient } from "@supabase/supabase-js";

/** Distinct YYYY-MM-DD dates with any DTR entry for the employee in range. */
export async function presentDaysFromDtr(
  db: SupabaseClient,
  args: { employeeId: string | number; from: string; to: string },
): Promise<string[]> {
  const { data, error } = await db
    .from("dtr_entries")
    .select("work_date")
    .eq("employee_id", args.employeeId as any)
    .gte("work_date", args.from)
    .lte("work_date", args.to)
    .order("work_date", { ascending: true });

  if (error) throw error;
  // Distinct + keep order
  const seen = new Set<string>();
  const out: string[] = [];
  (data ?? []).forEach((r: any) => {
    if (!seen.has(r.work_date)) {
      seen.add(r.work_date);
      out.push(r.work_date);
    }
  });
  return out;
}
