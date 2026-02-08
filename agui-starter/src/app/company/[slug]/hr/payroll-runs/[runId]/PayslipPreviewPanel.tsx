"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

type EmployeeSummary = {
  id: string;
  name: string;
  code: string;
};

type PayslipPreviewRow = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  ratePerDay: number;
  scheduledMinutes: number;
  workMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  undertimeMinutes: number;
  perMinuteRate: number;
  regularPay: number;
  overtimePay: number;
  undertimeDeduction: number;
  otherDeductions: { label: string; amount: number }[];
  deductionsTotal: number;
  grossPay: number;
  netPay: number;
  flags: { missingScheduleDays: number; openSegment: boolean; absentDays?: number };
  employeeName: string;
  employeeCode: string;
};

export default function PayslipPreviewPanel({
  houseSlug,
  runId,
  employees,
  runStatus,
}: {
  houseSlug: string;
  runId: string;
  employees: EmployeeSummary[];
  runStatus: "draft" | "finalized" | "posted" | "paid" | "cancelled";
}) {
  const [rows, setRows] = useState<PayslipPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const deductionsLocked = runStatus === "posted" || runStatus === "paid";
  const exportLocked = runStatus === "draft";

  const loadPayslips = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/hr/payroll-runs/${runId}/payslips`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load payslip previews.");
      }
      setRows((payload ?? []) as PayslipPreviewRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payslip previews.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  async function submitDeduction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!employeeId || !label.trim() || !amount.trim()) {
      setMessage("Select an employee and provide a label and amount.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/hr/payroll-runs/${runId}/deductions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          label: label.trim(),
          amount: Number(amount),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save deduction.");
      }

      setLabel("");
      setAmount("");
      setMessage("Deduction added.");
      await loadPayslips();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save deduction.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 overflow-hidden rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Payslip Preview (Read-only)</h3>
          <p className="text-sm text-muted-foreground">
            Computed from payroll run snapshots. Open segments are ignored for pay.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadPayslips} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-dashed border-border bg-white/60 p-4 text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-3">Employee</th>
              <th className="px-6 py-3">Regular pay</th>
              <th className="px-6 py-3">OT pay</th>
              <th className="px-6 py-3">Undertime deduction</th>
              <th className="px-6 py-3">Other deductions</th>
              <th className="px-6 py-3">Net pay</th>
              <th className="px-6 py-3">Flags</th>
              <th className="px-6 py-3">Payslip PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((row) => (
              <tr key={row.employeeId} className="bg-white/60">
                <td className="px-6 py-3">
                  <div className="font-medium text-foreground">
                    <Link
                      href={`/company/${houseSlug}/hr/payroll-runs/${runId}/payslips/${row.employeeId}`}
                      className="underline"
                    >
                      {row.employeeName}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground">{row.employeeCode}</div>
                </td>
                <td className="px-6 py-3 font-medium text-foreground">
                  {formatCurrency(row.regularPay)}
                </td>
                <td className="px-6 py-3">{formatCurrency(row.overtimePay)}</td>
                <td className="px-6 py-3 text-red-600">
                  {row.undertimeDeduction > 0 ? `-${formatCurrency(row.undertimeDeduction)}` : "—"}
                </td>
                <td className="px-6 py-3">
                  <div className="font-medium">{formatCurrency(row.deductionsTotal)}</div>
                  {row.otherDeductions.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {row.otherDeductions.map((deduction) => deduction.label).join(", ")}
                    </div>
                  ) : null}
                </td>
                <td className="px-6 py-3 font-semibold text-foreground">
                  {formatCurrency(row.netPay)}
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {row.flags.missingScheduleDays > 0 ? (
                      <Badge tone="warn">Missing schedule</Badge>
                    ) : null}
                    {row.flags.openSegment ? <Badge tone="warn">Open segment</Badge> : null}
                  </div>
                </td>
                <td className="px-6 py-3">
                  {exportLocked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      title="Finalize run first to export."
                    >
                      Download PDF
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`/api/hr/payroll-runs/${runId}/payslips/${row.employeeId}/pdf`}
                        title="Download Payslip PDF"
                      >
                        Download PDF
                      </a>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td
                  className="px-6 py-6 text-center text-sm text-muted-foreground"
                  colSpan={8}
                >
                  No payslip previews available for this run.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <form className="space-y-4 rounded-xl border border-border bg-white/60 p-4" onSubmit={submitDeduction}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Add manual deduction</h4>
            <p className="text-xs text-muted-foreground">
              Cash advances, uniforms, and other one-off adjustments.
            </p>
          </div>
          {deductionsLocked ? (
            <Badge tone="off">Locked after posting</Badge>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(160px,_1fr)_minmax(200px,_2fr)_minmax(140px,_1fr)]">
          <div className="space-y-2">
            <Label htmlFor="deduction-employee">Employee</Label>
            <select
              id="deduction-employee"
              className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={deductionsLocked}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deduction-label">Label</Label>
            <Input
              id="deduction-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Cash advance"
              disabled={deductionsLocked}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deduction-amount">Amount</Label>
            <Input
              id="deduction-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              disabled={deductionsLocked}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={deductionsLocked || saving}>
            {saving ? "Saving..." : "Add deduction"}
          </Button>
          {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
        </div>
      </form>
    </section>
  );
}
