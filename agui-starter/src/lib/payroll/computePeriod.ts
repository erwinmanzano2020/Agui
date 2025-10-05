import { SupabaseClient } from "@supabase/supabase-js";
import { fetchDtrWithRates } from "./fetchDtrWithRates";
import { computeRowPay, pickBasis, type PrimaryBasis } from "./calc";

export async function computeEmployeePayroll(
  db: SupabaseClient,
  params: {
    employeeId: string | number;
    from: string;
    to: string;
    preferBasis?: PrimaryBasis;
  },
) {
  const rows = await fetchDtrWithRates(db, params);
  const basis = rows.length
    ? pickBasis(rows[0], params.preferBasis)
    : (params.preferBasis ?? "daily");

  let gross = 0;
  const breakdown = rows.map((r) => {
    const pay = computeRowPay(r, basis);
    gross += pay;
    return { ...r, basis, pay };
  });

  return {
    employeeId: params.employeeId,
    basis,
    from: params.from,
    to: params.to,
    gross: +gross.toFixed(2),
    breakdown,
  };
}
