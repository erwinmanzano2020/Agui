import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/require-auth";
import { getPayrollRunWithItems } from "@/lib/hr/payroll-runs-server";
import CreateAdjustmentRunButton from "./CreateAdjustmentRunButton";
import DownloadPayrollRunPdfButton from "./DownloadPayrollRunPdfButton";
import FinalizePayrollRunButton from "./FinalizePayrollRunButton";
import MarkPayrollRunPaidForm from "./MarkPayrollRunPaidForm";
import PayslipPreviewPanel from "./PayslipPreviewPanel";
import PostPayrollRunButton from "./PostPayrollRunButton";

function formatMinutes(minutes: number) {
  const hours = minutes / 60;
  return `${minutes} min (${hours.toFixed(2)} hr)`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
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
  const canFinalize = run.status === "draft";
  const canPost = run.status === "finalized";
  const canMarkPaid = run.status === "posted";
  const canAdjust = run.status === "posted" || run.status === "paid";
  const statusTone = run.status === "draft" ? "off" : "on";
  const houseSlug = house.slug ?? slug;
  const employees = items.map((item) => ({
    id: item.employeeId,
    name: item.employeeName,
    code: item.employeeCode,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <Link href={`/company/${houseSlug}/hr/payroll-runs`} className="underline">
                Payroll runs
              </Link>
              {" "}→ Payroll run
            </p>
            <h2 className="text-xl font-semibold text-foreground">
              {run.periodStart} → {run.periodEnd}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Status</span>
              <Badge tone={statusTone} className="uppercase">
                {run.status}
              </Badge>
              {run.referenceCode ? (
                <span className="rounded-full border border-border px-2 py-1 text-xs text-foreground">
                  Ref {run.referenceCode}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 text-xs text-muted-foreground">
            <div className="rounded-lg border border-dashed border-border bg-white/60 px-4 py-2">
              Snapshot. Read-only. No money computed.
            </div>
            <DownloadPayrollRunPdfButton runId={run.id} runStatus={run.status} />
            {canFinalize ? <FinalizePayrollRunButton runId={run.id} houseId={house.id} /> : null}
            {canPost ? <PostPayrollRunButton runId={run.id} houseId={house.id} /> : null}
          </div>
        </div>
        <div className="mt-6 grid gap-4 text-xs text-muted-foreground md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border/70 bg-white/60 p-4">
            <div className="text-sm font-semibold text-foreground">Finalized</div>
            <div>Finalized at: {formatDateTime(run.finalizedAt)}</div>
            <div>Finalized by: {run.finalizedBy ?? "—"}</div>
            {run.finalizeNote ? <div>Note: {run.finalizeNote}</div> : null}
          </div>
          <div className="space-y-2 rounded-xl border border-border/70 bg-white/60 p-4">
            <div className="text-sm font-semibold text-foreground">Posted</div>
            <div>Posted at: {formatDateTime(run.postedAt)}</div>
            <div>Posted by: {run.postedBy ?? "—"}</div>
            {run.postNote ? <div>Note: {run.postNote}</div> : null}
          </div>
          <div className="space-y-2 rounded-xl border border-border/70 bg-white/60 p-4">
            <div className="text-sm font-semibold text-foreground">Paid</div>
            <div>Paid at: {formatDateTime(run.paidAt)}</div>
            <div>Paid by: {run.paidBy ?? "—"}</div>
            <div>Method: {run.paymentMethod ?? "—"}</div>
            {run.paymentNote ? <div>Note: {run.paymentNote}</div> : null}
          </div>
          {canAdjust ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-white/60 p-4">
              <div className="text-sm font-semibold text-foreground">Adjustments</div>
              <p>Create a linked adjustment run to correct posted values.</p>
              <CreateAdjustmentRunButton runId={run.id} houseId={house.id} houseSlug={houseSlug} />
            </div>
          ) : null}
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

      {items.length > 0 ? (
        <PayslipPreviewPanel
          houseSlug={houseSlug}
          runId={run.id}
          employees={employees}
          runStatus={run.status}
        />
      ) : null}

      {canMarkPaid ? (
        <MarkPayrollRunPaidForm runId={run.id} houseId={house.id} />
      ) : null}
    </div>
  );
}
