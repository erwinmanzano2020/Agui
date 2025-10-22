import Link from "next/link";

import PosFeatureToggle from "@/components/settings/pos-feature-toggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { loadUiConfig } from "@/lib/ui-config";

export default async function SettingsPage() {
  const { flags } = await loadUiConfig();
  const posEnabled = Boolean(flags?.pos_enabled);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">Features</h1>
            <p className="text-sm text-muted-foreground">
              Toggle beta modules that are rolling out to your organization.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PosFeatureToggle initialEnabled={posEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Customize the dashboard theme, presets, and wallpapers.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/appearance"
            className="inline-flex h-9 items-center rounded-[calc(var(--agui-radius))] border border-[color-mix(in_srgb,_var(--agui-card-border)_90%,_transparent)] px-3 text-sm font-medium text-[var(--agui-on-surface)] transition-colors hover:border-[color-mix(in_srgb,_var(--agui-primary)_45%,_var(--agui-card-border)_55%)] hover:bg-[color-mix(in_srgb,_var(--agui-primary)_10%,_var(--agui-card)_90%)]"
          >
            Open appearance settings
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
