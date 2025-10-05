import { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeRateRow, PayBasis } from "@/lib/types/payroll";

/** List all rates for an employee, newest first */
export async function listEmployeeRates(
  db: SupabaseClient,
  employeeId: string,
): Promise<EmployeeRateRow[]> {
  const { data, error } = await db
    .from("employee_rate_history")
    .select(
      "id, employee_id, effective_date, basis, amount, currency, note, created_at",
    )
    .eq("employee_id", employeeId)
    .order("effective_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EmployeeRateRow[];
}

/** Add a NEW rate row (we never overwrite old rates) */
export async function addEmployeeRate(
  db: SupabaseClient,
  input: {
    employee_id: string | number; // matches your employees.id type
    effective_date: string; // 'YYYY-MM-DD'
    basis: PayBasis;
    amount: number;
    note?: string;
    currency?: string; // defaults to 'PHP'
  },
): Promise<void> {
  const { error } = await db.from("employee_rate_history").insert({
    employee_id: input.employee_id as any, // keep type-flexible (uuid/int)
    effective_date: input.effective_date,
    basis: input.basis,
    amount: input.amount,
    note: input.note ?? null,
    currency: input.currency ?? "PHP",
  });

  if (error) throw error;
}
