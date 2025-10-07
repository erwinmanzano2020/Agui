import { supabase } from "@/lib/supabase";

/** Row shape we care about from dtr_entries */
export type DtrRow = {
  employee_id: string;
  work_date: string; // YYYY-MM-DD (DATE column)
  time_in: string | null;
  time_out: string | null;
  minutes_regular: number | null;
  minutes_ot: number | null;
};

/** Fetch DTR rows for one employee within an inclusive DATE range. */
export async function fetchDtrRange(opts: {
  employeeId: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}): Promise<DtrRow[]> {
  const { employeeId, start, end } = opts;

  // IMPORTANT: inclusive range (>= start AND <= end)
  const { data, error } = await supabase
    .from("dtr_entries")
    .select(
      "employee_id, work_date, time_in, time_out, minutes_regular, minutes_ot",
    )
    .eq("employee_id", employeeId)
    .gte("work_date", start)
    .lte("work_date", end)
    .order("work_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DtrRow[];
}

/** Presence rule used by payslip (matches what we do in the UI) */
export function isPresent(row: {
  time_in: string | null;
  time_out: string | null;
  minutes_regular?: number | null;
  minutes_ot?: number | null;
}) {
  return (
    Boolean(row.time_in || row.time_out) ||
    Number(row.minutes_regular || 0) > 0 ||
    Number(row.minutes_ot || 0) > 0
  );
}
