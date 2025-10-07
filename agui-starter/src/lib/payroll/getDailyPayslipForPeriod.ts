import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { presentDaysFromDtr } from "./presentDaysFromDtr";
import { dailyBasic } from "./dailyBasic";

/**
 * Compute a DAILY-basis payslip for a cutoff using historical "as-of" rates.
 * If no Supabase client is passed, it uses env vars to create one.
 */
export async function getDailyPayslipForPeriod(args: {
  employeeId: string | number;
  from: string; // 'YYYY-MM-DD' inclusive
  to: string; // 'YYYY-MM-DD' inclusive
  db?: SupabaseClient;
}) {
  const db =
    args.db ??
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

  const presentDays = await presentDaysFromDtr(db, {
    employeeId: args.employeeId,
    from: args.from,
    to: args.to,
  });

  return dailyBasic(db, {
    employeeId: args.employeeId,
    from: args.from,
    to: args.to,
    presentDays,
  });
}
