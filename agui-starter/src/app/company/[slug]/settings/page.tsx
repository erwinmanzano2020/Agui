import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { loadWorkspaceSettings } from "@/lib/settings/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function loadBusinessBySlug(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("houses")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle<{ id: string; name: string | null; slug: string | null }>();

  if (error) {
    console.error("Failed to load business for settings", error);
    return null;
  }

  return data ?? null;
}

export default async function CompanySettingsPage({ params }: { params: { slug: string } }) {
  const business = await loadBusinessBySlug(params.slug);
  if (!business) {
    notFound();
  }

  const workspaceSettings = await loadWorkspaceSettings(business.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Business</p>
        <h1 className="text-3xl font-semibold text-foreground">{business.name ?? business.slug ?? "Settings"}</h1>
        <p className="text-sm text-muted-foreground">Preview your workspace preferences and defaults.</p>
      </div>
      <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Coming soon: editing these preferences directly from the app. For now, you can review what will be configurable here.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">Labels</h2>
            <p className="text-sm text-muted-foreground">
              How your workspace names key concepts across the product.
            </p>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Workspace label</dt>
                <dd className="text-right font-medium text-foreground">{workspaceSettings.labels.house}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Branch label</dt>
                <dd className="text-right font-medium text-foreground">{workspaceSettings.labels.branch}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Pass label</dt>
                <dd className="text-right font-medium text-foreground">{workspaceSettings.labels.pass}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Discount labels</dt>
                <dd className="text-right font-medium text-foreground">
                  {workspaceSettings.labels.discounts.loyalty}, {workspaceSettings.labels.discounts.wholesale},
                  {" "}
                  {workspaceSettings.labels.discounts.manual}, {workspaceSettings.labels.discounts.promo}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">Receipt defaults</h2>
            <p className="text-sm text-muted-foreground">What customers see on receipts and invoices.</p>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Footer text</dt>
                <dd className="text-right font-medium text-foreground">{workspaceSettings.receipt.footerText}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Show total savings</dt>
                <dd className="text-right font-medium text-foreground">
                  {workspaceSettings.receipt.showTotalSavings ? "Enabled" : "Disabled"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Printer profile</dt>
                <dd className="text-right font-medium text-foreground">{workspaceSettings.receipt.printProfile}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">SOP & cashiering</h2>
            <p className="text-sm text-muted-foreground">Helpful context for shift flows.</p>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Start shift hint</dt>
                <dd className="text-right font-medium text-foreground">{workspaceSettings.sop.startShiftHint}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Blind drop hint</dt>
                <dd className="text-right font-medium text-foreground">{workspaceSettings.sop.blindDropHint}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Variance thresholds</dt>
                <dd className="text-right font-medium text-foreground">
                  {workspaceSettings.sop.cashierVarianceThresholds.small} /{workspaceSettings.sop.cashierVarianceThresholds.medium}
                  /{workspaceSettings.sop.cashierVarianceThresholds.large} pesos
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">POS defaults</h2>
            <p className="text-sm text-muted-foreground">Flags that influence POS and cashiering behavior.</p>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Blind drops</dt>
                <dd className="text-right font-medium text-foreground">
                  {workspaceSettings.pos.blindDropEnabled ? "Allowed" : "Disabled"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Overage pool</dt>
                <dd className="text-right font-medium text-foreground">
                  {workspaceSettings.pos.overagePool.enabled ? "Enabled" : "Disabled"}
                  {workspaceSettings.pos.overagePool.enabled
                    ? ` (up to ${Math.round(workspaceSettings.pos.overagePool.maxOffsetRatio * 100)}%)`
                    : null}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">GM UI</dt>
                <dd className="text-right font-medium text-foreground">
                  {workspaceSettings.ui.alwaysShowStartBusinessTile ? "Start tile forced" : "Default visibility"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
