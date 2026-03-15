import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { listBranchesForHouse, listEmployeesByHouse } from "@/lib/hr/employees-server";
import { computePayrollPreviewForHousePeriod } from "@/lib/hr/payroll-preview-server";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDateInput(value: string | undefined, fallback: string) {
  if (value && DATE_REGEX.test(value)) return value;
  return fallback;
}

function formatMinutes(minutes: number) {
  const hours = minutes / 60;
  return `${minutes} min (${hours.toFixed(2)} hr)`;
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayrollPreviewPage({ params, searchParams }: Props) {
  const [paramsValue, rawSearchValue] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const { slug } = paramsValue;
  const rawSearch = rawSearchValue as Record<string, string | string[] | undefined>;
  const basePath = `/company/${slug}/hr/payroll-preview`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);
  const startParam = typeof rawSearch.startDate === "string" ? rawSearch.startDate : undefined;
  const endParam = typeof rawSearch.endDate === "string" ? rawSearch.endDate : undefined;
  const startDate = formatDateInput(startParam, today);
  const endDate = formatDateInput(endParam, today);

  const [employeesResult, branchesResult] = await Promise.all([
    listEmployeesByHouse(supabase, house.id, { status: "active" }),
    listBranchesForHouse(supabase, house.id),
  ]);

  const employees = employeesResult.employees;
  const branches = branchesResult.branches;

  const employeeFilter = typeof rawSearch.employee === "string" ? rawSearch.employee : "";
  const branchFilter = typeof rawSearch.branch === "string" ? rawSearch.branch : "";

  const allowedEmployeeIds = new Set(employees.map((employee) => employee.id));
  const allowedBranchIds = new Set(branches.map((branch) => branch.id));

  const filteredEmployeeId = allowedEmployeeIds.has(employeeFilter) ? employeeFilter : "";
  const filteredBranchId = allowedBranchIds.has(branchFilter) ? branchFilter : "";

  const preview = await computePayrollPreviewForHousePeriod(supabase, {
    houseId: house.id,
    startDate,
    endDate,
    branchId: filteredBranchId || null,
    employeeId: filteredEmployeeId || null,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Payroll Preview</h2>
          <p className="text-sm text-muted-foreground">
            Preview only (read-only). No payslip/payroll is generated.
          </p>
        </div>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Start date
            <input
              type="date"
              name="startDate"
              defaultValue={startDate}
              className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            End date
            <input
              type="date"
              name="endDate"
              defaultValue={endDate}
              className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Employee (optional)
            <select
              name="employee"
              defaultValue={filteredEmployeeId}
              className="min-w-[220px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Branch (optional)
            <select
              name="branch"
              defaultValue={filteredBranchId}
              className="min-w-[220px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg border border-border bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Load preview
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Summary</h3>
        <div className="mt-3 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-xs uppercase">Employees</div>
            <div className="text-base font-semibold text-foreground">{preview.summary.employeeCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase">Work minutes</div>
            <div className="text-base font-semibold text-foreground">
              {formatMinutes(preview.summary.totalWorkMinutes)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase">Derived OT (raw)</div>
            <div className="text-base font-semibold text-foreground">
              {formatMinutes(preview.summary.totalDerivedOtMinutesRaw)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase">Derived OT (rounded)</div>
            <div className="text-base font-semibold text-foreground">
              {formatMinutes(preview.summary.totalDerivedOtMinutesRounded)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase">Open segment days</div>
            <div className="text-base font-semibold text-foreground">{preview.summary.openSegmentCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase">Missing schedule days</div>
            <div className="text-base font-semibold text-foreground">{preview.summary.missingScheduleCount}</div>
          </div>
        </div>
      </section>

      {preview.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
          No payroll preview data for the selected period.
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-white/70 shadow-sm">
          <div className="border-b border-border/70 px-6 py-4">
            <h3 className="text-lg font-semibold text-foreground">Preview by employee</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Branch</th>
                  <th className="px-6 py-3">Work minutes</th>
                  <th className="px-6 py-3">OT raw</th>
                  <th className="px-6 py-3">OT rounded</th>
                  <th className="px-6 py-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {preview.rows.map((row) => {
                  const branchName = branches.find((branch) => branch.id === row.branchId)?.name ?? "—";
                  return (
                    <tr key={row.employeeId} className="bg-white/60">
                      <td className="px-6 py-3">
                        <div className="font-medium text-foreground">{row.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{row.employeeCode}</div>
                      </td>
                      <td className="px-6 py-3">{branchName}</td>
                      <td className="px-6 py-3">{formatMinutes(row.workMinutesTotal)}</td>
                      <td className="px-6 py-3">{formatMinutes(row.derivedOtMinutesRawTotal)}</td>
                      <td className="px-6 py-3">{formatMinutes(row.derivedOtMinutesRoundedTotal)}</td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">
                        <div>Missing schedule days: {row.flags.missingScheduleDays}</div>
                        <div>Open segment days: {row.flags.openSegmentDays}</div>
                        {row.flags.hasCorrectedSegments ? <div>Corrected segments</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
