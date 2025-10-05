export type PayBasis =
  | "hourly"
  | "daily"
  | "semi_monthly"
  | "monthly"
  | "piece";

export interface EmployeeRateRow {
  id: string;
  employee_id: string;
  effective_date: string; // YYYY-MM-DD
  basis: PayBasis;
  amount: number;
  currency: string;
  note?: string | null;
  created_at: string; // ISO timestamp
}
