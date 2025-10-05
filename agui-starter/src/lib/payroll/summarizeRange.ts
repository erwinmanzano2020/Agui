// agui-starter/src/lib/payroll/summarizeRange.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DtrWithRates } from "./fetchDtrWithRates";
import { fetchDtrWithRates } from "./fetchDtrWithRates";
import {
  computeRowPayAuto,
  pickBasis,
  type PrimaryBasis,
  type OrgSettings,
} from "./calc";

export interface RowWithPay extends DtrWithRates {
  basis: PrimaryBasis;
  pay: number; // computed per row
}

export interface RangeSummary {
  rows: RowWithPay[];
  totals: {
    gross: number; // sum of pay
    by_basis: Partial<Record<PrimaryBasis, number>>;
    count: number; // number of rows
  };
}

/**
 * Fetch DTR rows for a range and compute per-row pay + totals.
 * - preferBasis: force a single basis if set (otherwise we auto-pick: monthly > semi_monthly > daily > hourly)
 * - settings: optional org settings; kept for future hourly/daily conversions
 */
export async function summarizeRange(
  db: SupabaseClient,
  args: {
    from: string;
    to: string;
    employeeId?: string | number;
    preferBasis?: PrimaryBasis;
    settings?: Partial<OrgSettings>;
  }
): Promise<RangeSummary> {
  const settings: OrgSettings = {
    hours_per_day: 8,
    days_per_month_divisor: 26,
    ...(args.settings ?? {}),
  };

  const dtrs = await fetchDtrWithRates(db, {
    from: args.from,
    to: args.to,
    employeeId: args.employeeId,
  });

  const rows: RowWithPay[] = dtrs.map((r) => {
    const basis = pickBasis(r, args.preferBasis);
    const pay = computeRowPayAuto(r, args.preferBasis, settings);
    return { ...r, basis, pay };
  });

  const totals = rows.reduce<RangeSummary["totals"]>(
    (acc, r) => {
      acc.gross += r.pay;
      acc.by_basis[r.basis] = (acc.by_basis[r.basis] ?? 0) + r.pay;
      acc.count += 1;
      return acc;
    },
    { gross: 0, by_basis: {}, count: 0 }
  );

  // round to 2 decimals
  totals.gross = +totals.gross.toFixed(2);
  (Object.keys(totals.by_basis) as PrimaryBasis[]).forEach((k) => {
    totals.by_basis[k] = +Number(totals.by_basis[k]).toFixed(2);
  });

  return { rows, totals };
}
