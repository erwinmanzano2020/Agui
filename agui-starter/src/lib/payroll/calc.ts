// agui-starter/src/lib/payroll/calc.ts
import type { DtrWithRates } from "./fetchDtrWithRates";

export type PrimaryBasis = "hourly" | "daily" | "semi_monthly" | "monthly";

export interface OrgSettings {
  /** used to compute hourly pay when DTR hours aren't present */
  hours_per_day: number; // default 8
  /** kept for future monthly spreads */
  days_per_month_divisor: number; // default 26
}

/** Choose a basis when multiple are present. Priority: monthly > semi_monthly > daily > hourly */
export function pickBasis(
  row: DtrWithRates,
  prefer?: PrimaryBasis,
): PrimaryBasis {
  if (prefer) return prefer;
  if (row.monthly_rate != null) return "monthly";
  if (row.semi_monthly_rate != null) return "semi_monthly";
  if (row.daily_rate != null) return "daily";
  return "hourly";
}

/** Compute pay for one row based on basis (view has no hours/present) */
export function computeRowPay(
  row: DtrWithRates,
  basis: PrimaryBasis,
  _settings: OrgSettings = { hours_per_day: 8, days_per_month_divisor: 26 },
): number {
  switch (basis) {
    case "hourly": {
      const rate = Number(row.hourly_rate ?? 0);
      const amt = rate * Number(_settings.hours_per_day ?? 8);
      return +amt.toFixed(2);
    }
    case "daily": {
      const rate = Number(row.daily_rate ?? 0);
      return +rate.toFixed(2);
    }
    case "semi_monthly": {
      const rate = Number(row.semi_monthly_rate ?? 0);
      return +rate.toFixed(2);
    }
    case "monthly": {
      const rate = Number(row.monthly_rate ?? 0);
      return +rate.toFixed(2);
    }
  }
}

/** Convenience: auto-pick basis then compute */
export function computeRowPayAuto(
  row: DtrWithRates,
  prefer?: PrimaryBasis,
  settings: OrgSettings = { hours_per_day: 8, days_per_month_divisor: 26 },
): number {
  return computeRowPay(row, pickBasis(row, prefer), settings);
}
