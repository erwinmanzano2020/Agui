import { Suspense } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadUiConfig } from "@/lib/ui-config";

export const metadata = { title: "POS" };

export default async function PosPage() {
  const { flags } = await loadUiConfig();
  const posEnabled = Boolean(flags?.pos_enabled);

  if (!posEnabled) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="text-lg font-semibold text-foreground">POS is disabled</div>
            <p className="text-sm text-muted-foreground">
              Turn on the POS feature in Settings → Features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 text-foreground md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">Stub shell · token-aware</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            New Sale
          </Button>
          <Button size="sm">Open Register</Button>
        </div>
      </header>

      <Suspense fallback={<div className="opacity-50">Loading…</div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PosCard title="Register" subtitle="0 sessions" status="Ready" />
          <PosCard title="Catalog" subtitle="128 items" status="Synced" />
          <PosCard title="Customers" subtitle="4,120 records" status="Live" />
          <PosCard title="Discounts" subtitle="Active: 3" status="Ready" />
          <PosCard title="Reports" subtitle="Daily summary" status="Preview" />
          <PosCard title="Settings" subtitle="Customize POS" status="Beta" />
        </div>
      </Suspense>
    </div>
  );
}

function PosCard({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle?: string;
  status?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-semibold text-foreground">{title}</div>
          {status && <Badge tone="on">{status}</Badge>}
        </div>
        {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
        <div className="h-28 rounded-[calc(var(--agui-radius)+4px)] border border-border bg-card/50" />
      </CardContent>
    </Card>
  );
}
