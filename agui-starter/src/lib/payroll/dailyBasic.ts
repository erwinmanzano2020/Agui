import { SupabaseClient } from "@supabase/supabase-js";
import { computeDailyPayslip } from "./computeDailyPayslip";

/**
 * Call this from your payslip loader/server action.
 * @param db Supabase server client
 * @param args.employeeId employees.id (uuid or number)
 * @param args.from inclusive 'YYYY-MM-DD'
 * @param args.to inclusive 'YYYY-MM-DD'
 * @param args.presentDays array of 'YYYY-MM-DD' you already mark as present
 */
export async function dailyBasic(
  db: SupabaseClient,
  args: {
    employeeId: string | number;
    from: string;
    to: string;
    presentDays: string[];
  },
) {
  return computeDailyPayslip(db, args);
}
