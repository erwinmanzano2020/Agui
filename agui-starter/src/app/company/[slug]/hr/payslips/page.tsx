import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { getPayrollRunWithItems, listPayrollRunsForHouse } from "@/lib/hr/payroll-runs-server";
import PayslipPreviewPanel from "@/app/company/[slug]/hr/payroll-runs/[runId]/PayslipPreviewPanel";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HrPayslipsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | undefined>;
  const basePath = `/company/${slug}/hr/payslips`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase.from("houses").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!house) notFound();

  const runs = await listPayrollRunsForHouse(supabase, house.id);
  const selectedRunId = (typeof search.runId === "string" ? search.runId : "") || runs[0]?.id || "";
  const selectedRun = selectedRunId ? await getPayrollRunWithItems(supabase, house.id, selectedRunId) : null;

  const employees = (selectedRun?.items ?? []).map((item) => ({
    id: item.employeeId,
    name: item.employeeName,
    code: item.employeeCode,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Payslips</h2>
          <p className="text-sm text-muted-foreground">
            Review computed payslips by payroll run using the same snapshot-based computation and manual deductions shown in payroll run detail.
          </p>
          <p className="text-xs text-muted-foreground">
            Finalize locks snapshot rows only. Posting locks deductions and payslip outputs. Government deductions and payout integrations remain intentionally deferred.
          </p>
        </div>
        {runs.length > 0 ? (
          <form method="get" action={basePath} className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="runId" className="text-sm text-muted-foreground">Payroll run</label>
            <select id="runId" name="runId" defaultValue={selectedRunId} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.periodStart} → {run.periodEnd} ({run.status})
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">Open payslips</button>
            <Link href={`/company/${house.slug ?? slug}/hr/payroll-runs/${selectedRunId}`} className="text-sm underline">
              Open run details
            </Link>
          </form>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-white/60 p-4 text-sm text-muted-foreground">
            No payroll runs yet. Create a payroll run first to review payslips.
          </div>
        )}
      </section>

      {selectedRun && employees.length > 0 ? (
        <PayslipPreviewPanel
          houseSlug={house.slug ?? slug}
          runId={selectedRun.run.id}
          employees={employees}
          runStatus={selectedRun.run.status}
        />
      ) : null}

      {selectedRun && employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
          This run has no snapshot rows yet, so there are no computed payslips to show.
        </div>
      ) : null}
    </div>
  );
}
