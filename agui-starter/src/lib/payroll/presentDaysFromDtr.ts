import { SupabaseClient } from "@supabase/supabase-js";

/** Distinct YYYY-MM-DD dates with any DTR entry for the employee in range. */
export async function presentDaysFromDtr(
  db: SupabaseClient,
  args: { employeeId: string | number; from: string; to: string },
): Promise<string[]> {
  const { data, error } = await db
    .from("dtr_entries")
    .select("work_date")
    .eq("employee_id", args.employeeId)
    .gte("work_date", args.from)
    .lte("work_date", args.to)
    .order("work_date", { ascending: true });

  if (error) throw error;
  // Distinct + keep order
  const seen = new Set<string>();
  const out: string[] = [];
  const rows = (data ?? []) as Array<{ work_date: string | null }>;
  rows.forEach((row) => {
    const date = row.work_date;
    if (date && !seen.has(date)) {
      seen.add(date);
      out.push(date);
    }
  });
  return out;
}
