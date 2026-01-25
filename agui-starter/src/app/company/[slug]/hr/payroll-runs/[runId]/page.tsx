import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { getPayrollRunWithItems } from "@/lib/hr/payroll-runs-server";

function formatMinutes(minutes: number) {
  const hours = minutes / 60;
  return `${minutes} min (${hours.toFixed(2)} hr)`;
}

type Props = {
  params: Promise<{ slug: string; runId: string }>;
};

export default async function PayrollRunDetailPage({ params }: Props) {
  const { slug, runId } = await params;
  const basePath = `/company/${slug}/hr/payroll-runs/${runId}`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const result = await getPayrollRunWithItems(supabase, house.id, runId);
  if (!result) {
    notFound();
  }

  const { run, items } = result;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <Link href={`/company/${house.slug ?? slug}/hr/payroll-runs`} className="underline">
                Payroll runs
              </Link>
              {" "}→ Draft run
            </p>
            <h2 className="text-xl font-semibold text-foreground">
              {run.periodStart} → {run.periodEnd}
            </h2>
            <p className="text-sm text-muted-foreground capitalize">Status: {run.status}</p>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-white/60 px-4 py-2 text-xs text-muted-foreground">
            Snapshot. Read-only. No money computed.
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
          No payroll preview rows were captured for this period.
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-white/70 shadow-sm">
          <div className="border-b border-border/70 px-6 py-4">
            <h3 className="text-lg font-semibold text-foreground">Snapshot rows</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Work minutes</th>
                  <th className="px-6 py-3">OT raw</th>
                  <th className="px-6 py-3">OT rounded</th>
                  <th className="px-6 py-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {items.map((item) => (
                  <tr key={item.id} className="bg-white/60">
                    <td className="px-6 py-3">
                      <div className="font-medium text-foreground">{item.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{item.employeeCode}</div>
                    </td>
                    <td className="px-6 py-3">{formatMinutes(item.workMinutes)}</td>
                    <td className="px-6 py-3">{formatMinutes(item.overtimeMinutesRaw)}</td>
                    <td className="px-6 py-3">{formatMinutes(item.overtimeMinutesRounded)}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">
                      <div>Missing schedule days: {item.missingScheduleDays}</div>
                      <div>Open segment days: {item.openSegmentDays}</div>
                      <div>Corrected segment days: {item.correctedSegmentDays}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
