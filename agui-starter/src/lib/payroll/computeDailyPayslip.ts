import { SupabaseClient } from "@supabase/supabase-js";
import { fetchDtrWithRates } from "./fetchDtrWithRates";

export type DailyBreakdownRow = {
  date: string; // 'YYYY-MM-DD'
  rate: number; // as-of daily rate for this date
  isPresent: boolean; // you decide presence outside (existing logic)
  pay: number; // rate if present, else 0
};

export type DailyPayslipResult = {
  basis: "daily";
  daysPresent: number;
  gross: number;
  breakdown: DailyBreakdownRow[];
};

/**
 * Compute a daily-basis payslip using the historical "as-of" daily rate per date.
 * - We DO NOT guess attendance here — you pass presentDays based on your existing DTR logic.
 * - Works with uuid or integer employee IDs.
 */
export async function computeDailyPayslip(
  db: SupabaseClient,
  args: {
    employeeId: string | number;
    from: string; // 'YYYY-MM-DD' inclusive
    to: string; // 'YYYY-MM-DD' inclusive
    presentDays: string[]; // e.g., ['2025-10-09', '2025-10-10']
  },
): Promise<DailyPayslipResult> {
  const rows = await fetchDtrWithRates(db, {
    employeeId: args.employeeId,
    from: args.from,
    to: args.to,
  });

  const present = new Set(args.presentDays);
  let daysPresent = 0;
  let gross = 0;

  const breakdown = rows.map((r) => {
    const isPresent = present.has(r.work_date);
    const rate = Number(r.daily_rate ?? 0);
    const pay = isPresent ? rate : 0;

    if (isPresent) daysPresent += 1;
    gross += pay;

    return {
      date: r.work_date,
      rate,
      isPresent,
      pay: +pay.toFixed(2),
    };
  });

  return {
    basis: "daily",
    daysPresent,
    gross: +gross.toFixed(2),
    breakdown,
  };
}
