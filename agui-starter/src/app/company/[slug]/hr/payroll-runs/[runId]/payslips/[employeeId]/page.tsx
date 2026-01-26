import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/require-auth";
import { computePayslipForPayrollRunEmployee } from "@/lib/hr/payslip-server";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

type Props = {
  params: Promise<{ slug: string; runId: string; employeeId: string }>;
};

export default async function PayrollRunPayslipDetailPage({ params }: Props) {
  const { slug, runId, employeeId } = await params;
  const basePath = `/company/${slug}/hr/payroll-runs/${runId}/payslips/${employeeId}`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, code")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee) {
    notFound();
  }

  let payslip;
  try {
    payslip = await computePayslipForPayrollRunEmployee(supabase, {
      houseId: house.id,
      runId,
      employeeId,
    });
  } catch {
    notFound();
  }

  const houseSlug = house.slug ?? slug;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          <Link href={`/company/${houseSlug}/hr/payroll-runs/${runId}`} className="underline">
            Payroll run
          </Link>
          {" "}→ Payslip preview
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{employee.full_name}</h2>
            <p className="text-sm text-muted-foreground">{employee.code}</p>
            <p className="text-sm text-muted-foreground">
              Period: {payslip.periodStart} → {payslip.periodEnd}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {payslip.flags.missingScheduleDays > 0 ? (
              <Badge tone="warn">Missing schedule</Badge>
            ) : null}
            {payslip.flags.openSegment ? <Badge tone="warn">Open segment</Badge> : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Pay breakdown</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-4">
              <span>Rate per day</span>
              <span className="font-medium text-foreground">{formatCurrency(payslip.ratePerDay)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Scheduled minutes</span>
              <span className="font-medium text-foreground">{payslip.scheduledMinutes}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Work minutes</span>
              <span className="font-medium text-foreground">{payslip.workMinutes}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Regular minutes</span>
              <span className="font-medium text-foreground">{payslip.regularMinutes}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Overtime minutes</span>
              <span className="font-medium text-foreground">{payslip.overtimeMinutes}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Undertime minutes</span>
              <span className="font-medium text-foreground">{payslip.undertimeMinutes}</span>
            </div>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-4">
              <span>Regular pay</span>
              <span className="font-medium text-foreground">{formatCurrency(payslip.regularPay)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Overtime pay</span>
              <span className="font-medium text-foreground">{formatCurrency(payslip.overtimePay)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Undertime deduction</span>
              <span className="font-medium text-foreground">
                {payslip.undertimeDeduction > 0
                  ? `-${formatCurrency(payslip.undertimeDeduction)}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Other deductions</span>
              <span className="font-medium text-foreground">{formatCurrency(payslip.deductionsTotal)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Gross pay</span>
              <span className="font-medium text-foreground">{formatCurrency(payslip.grossPay)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Net pay</span>
              <span className="text-base font-semibold text-foreground">{formatCurrency(payslip.netPay)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Manual deductions</h3>
        {payslip.otherDeductions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No manual deductions recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {payslip.otherDeductions.map((deduction, index) => (
              <li key={`${deduction.label}-${index}`} className="flex items-center justify-between">
                <span className="text-muted-foreground">{deduction.label}</span>
                <span className="font-medium text-foreground">{formatCurrency(deduction.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
