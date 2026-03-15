import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { listPayrollRunsForHouse } from "@/lib/hr/payroll-runs-server";
import { PayrollRunCreateForm } from "./PayrollRunCreateForm";

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return startDate;
  return `${startDate} → ${endDate}`;
}

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PayrollRunsPage({ params }: Props) {
  const { slug } = await params;
  const basePath = `/company/${slug}/hr/payroll-runs`;
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
  const runs = await listPayrollRunsForHouse(supabase, house.id);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Payroll Runs</h2>
          <p className="text-sm text-muted-foreground">
            Snapshot-only draft runs. This does not calculate money or generate payslips.
          </p>
        </div>
        <PayrollRunCreateForm
          houseId={house.id}
          houseSlug={house.slug ?? slug}
          defaultStartDate={today}
          defaultEndDate={today}
        />
      </section>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
          No payroll runs yet. Create a draft run to snapshot the current preview.
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-white/70 shadow-sm">
          <div className="border-b border-border/70 px-6 py-4">
            <h3 className="text-lg font-semibold text-foreground">Draft runs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Period</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {runs.map((run) => (
                  <tr key={run.id} className="bg-white/60">
                    <td className="px-6 py-3">
                      <Link
                        href={`/company/${house.slug ?? slug}/hr/payroll-runs/${run.id}`}
                        className="font-medium text-foreground underline"
                      >
                        {formatDateRange(run.periodStart, run.periodEnd)}
                      </Link>
                    </td>
                    <td className="px-6 py-3 capitalize text-muted-foreground">{run.status}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      })}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{run.itemCount}</td>
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
