"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { getSupabase } from "@/lib/supabase";
import {
  TENANT_THEME_DEFAULTS,
  applyTenantTheme,
  getTenantTheme,
  saveTenantTheme,
  resolveTenantId,
  type TenantThemeBackground,
  type TenantThemeShape,
} from "@/lib/tenantTheme";
import { getAccentContrastInfo } from "@/lib/theme";

const HEX_FULL = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type FormState = {
  accent: string;
  background: TenantThemeBackground;
  shape: TenantThemeShape;
};

type LoadState = "loading" | "ready";

type TenantResolution = {
  tenantId: string | null;
  message: string | null;
};

function formatHexCandidate(value: string): string {
  const trimmed = value.replace(/[^0-9a-fA-F#]/g, "");
  if (!trimmed) return "";
  const withoutHashes = trimmed.replace(/#/g, "");
  const limited = withoutHashes.slice(0, 6);
  return `#${limited}`.toLowerCase();
}

function AppearanceEditor() {
  const toast = useToast();

  const [form, setForm] = React.useState<FormState>({
    accent: TENANT_THEME_DEFAULTS.accent,
    background: TENANT_THEME_DEFAULTS.background,
    shape: TENANT_THEME_DEFAULTS.shape,
  });
  const [accentInput, setAccentInput] = React.useState<string>(TENANT_THEME_DEFAULTS.accent);
  const [initial, setInitial] = React.useState<FormState | null>(null);
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [tenantState, setTenantState] = React.useState<TenantResolution>({ tenantId: null, message: null });
  const [saving, setSaving] = React.useState(false);

  const accentIsValid = HEX_FULL.test(accentInput);
  const isDirty =
    initial !== null &&
    (form.accent !== initial.accent || form.background !== initial.background || form.shape !== initial.shape);
  const canSave = !!tenantState.tenantId && accentIsValid && isDirty && !saving;

  const contrastInfo = React.useMemo(() => getAccentContrastInfo(form.accent), [form.accent]);

  React.useEffect(() => {
    let active = true;
    async function load() {
      setLoadState("loading");
      const supabase = getSupabase();
      if (!supabase) {
        if (!active) return;
        setInitial({
          accent: TENANT_THEME_DEFAULTS.accent,
          background: TENANT_THEME_DEFAULTS.background,
          shape: TENANT_THEME_DEFAULTS.shape,
        });
        setForm({
          accent: TENANT_THEME_DEFAULTS.accent,
          background: TENANT_THEME_DEFAULTS.background,
          shape: TENANT_THEME_DEFAULTS.shape,
        });
        setAccentInput(TENANT_THEME_DEFAULTS.accent);
        setTenantState({
          tenantId: null,
          message: "Supabase is not configured. Changes won’t persist between sessions.",
        });
        setLoadState("ready");
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!active) return;

        if (userError || !userData?.user) {
          setInitial({
            accent: TENANT_THEME_DEFAULTS.accent,
            background: TENANT_THEME_DEFAULTS.background,
            shape: TENANT_THEME_DEFAULTS.shape,
          });
          setForm({
            accent: TENANT_THEME_DEFAULTS.accent,
            background: TENANT_THEME_DEFAULTS.background,
            shape: TENANT_THEME_DEFAULTS.shape,
          });
          setAccentInput(TENANT_THEME_DEFAULTS.accent);
          setTenantState({
            tenantId: null,
            message: "You’re not signed in, so appearance changes can’t be saved.",
          });
          setLoadState("ready");
          return;
        }

        const tenantId = resolveTenantId(userData.user);
        if (!tenantId) {
          setInitial({
            accent: TENANT_THEME_DEFAULTS.accent,
            background: TENANT_THEME_DEFAULTS.background,
            shape: TENANT_THEME_DEFAULTS.shape,
          });
          setForm({
            accent: TENANT_THEME_DEFAULTS.accent,
            background: TENANT_THEME_DEFAULTS.background,
            shape: TENANT_THEME_DEFAULTS.shape,
          });
          setAccentInput(TENANT_THEME_DEFAULTS.accent);
          setTenantState({ tenantId: null, message: "This account is missing a tenant, so we can’t save changes." });
          setLoadState("ready");
          return;
        }

        const theme = await getTenantTheme(tenantId);
        if (!active) return;

        const next: FormState = {
          accent: theme.accent,
          background: theme.background,
          shape: theme.shape,
        };

        setInitial(next);
        setForm(next);
        setAccentInput(theme.accent);
        setTenantState({ tenantId, message: null });
        setLoadState("ready");
      } catch (error) {
        console.warn("Failed to load tenant theme", error);
        if (!active) return;
        setInitial({
          accent: TENANT_THEME_DEFAULTS.accent,
          background: TENANT_THEME_DEFAULTS.background,
          shape: TENANT_THEME_DEFAULTS.shape,
        });
        setForm({
          accent: TENANT_THEME_DEFAULTS.accent,
          background: TENANT_THEME_DEFAULTS.background,
          shape: TENANT_THEME_DEFAULTS.shape,
        });
        setAccentInput(TENANT_THEME_DEFAULTS.accent);
        setTenantState({ tenantId: null, message: "We couldn’t load your saved theme. Using defaults for now." });
        setLoadState("ready");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    applyTenantTheme({ accent: form.accent, background: form.background, shape: form.shape });
  }, [form.accent, form.background, form.shape]);

  const onAccentInputChange = React.useCallback((value: string) => {
    const formatted = formatHexCandidate(value);
    setAccentInput(formatted);
    if (HEX_FULL.test(formatted)) {
      setForm((prev) => ({ ...prev, accent: formatted.toLowerCase() }));
    }
  }, []);

  const onAccentPickerChange = React.useCallback((value: string) => {
    setAccentInput(value.toLowerCase());
    setForm((prev) => ({ ...prev, accent: value.toLowerCase() }));
  }, []);

  const resetToDefaults = React.useCallback(() => {
    setForm({
      accent: TENANT_THEME_DEFAULTS.accent,
      background: TENANT_THEME_DEFAULTS.background,
      shape: TENANT_THEME_DEFAULTS.shape,
    });
    setAccentInput(TENANT_THEME_DEFAULTS.accent);
  }, []);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!tenantState.tenantId) {
        toast.error("No tenant is associated with this account.");
        return;
      }
      if (!HEX_FULL.test(form.accent)) {
        toast.error("Accent color must be a valid hex value.");
        return;
      }

      setSaving(true);
      try {
        await saveTenantTheme({
          tenant_id: tenantState.tenantId,
          accent: form.accent,
          background: form.background,
          shape: form.shape,
        });
        setInitial({ ...form });
        toast.success("Appearance saved");
      } catch (error) {
        console.error(error);
        toast.error("Failed to save appearance settings");
      } finally {
        setSaving(false);
      }
    },
    [form, tenantState.tenantId, toast]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--agui-on-surface)]">Appearance</h1>
        <p className="mt-1 text-sm text-[var(--agui-muted-foreground)]">
          Adjust the accent color, default background, and border shape for your tenant.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form onSubmit={onSubmit} className="space-y-4">
          <Card>
            <CardContent className="space-y-6">
              {tenantState.message && (
                <div className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-muted-foreground)_25%,_transparent)] bg-[color-mix(in_srgb,_var(--agui-surface)_92%,_var(--agui-muted-foreground)_8%)] px-4 py-3 text-sm text-[var(--agui-muted-foreground)]">
                  {tenantState.message}
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-[var(--agui-on-surface)]">Accent color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.accent}
                    onChange={(event) => onAccentPickerChange(event.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-[var(--agui-radius)] border border-border bg-transparent"
                    aria-label="Accent color"
                  />
                  <Input
                    value={accentInput}
                    onChange={(event) => onAccentInputChange(event.target.value)}
                    placeholder="#009e4a"
                    aria-label="Accent color hex"
                  />
                </div>
                <p className="text-xs text-[var(--agui-muted-foreground)]">
                  Used for buttons, highlights, and other primary accents.
                </p>
                {accentInput.length > 0 && !accentIsValid && (
                  <p className="text-xs text-danger">Enter a valid 3 or 6 digit hex code like #009e4a.</p>
                )}
                {!contrastInfo.passesAa && (
                  <p className="text-xs" style={{ color: "var(--warning)" }}>
                    Contrast is {contrastInfo.contrastRatio.toFixed(2)}:1. We’ll use {contrastInfo.recommendedText.toUpperCase()} text
                    automatically for readability.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--agui-on-surface)]">Background mode</label>
                <select
                  value={form.background}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, background: event.target.value as TenantThemeBackground }))
                  }
                  className="select"
                >
                  <option value="system">System default</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
                <p className="text-xs text-[var(--agui-muted-foreground)]">
                  Choose a fixed background or follow the viewer’s device preference.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--agui-on-surface)]">Shape</label>
                <select
                  value={form.shape}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, shape: event.target.value as TenantThemeShape }))
                  }
                  className="select"
                >
                  <option value="rounded">Rounded</option>
                  <option value="circle">Circle</option>
                </select>
                <p className="text-xs text-[var(--agui-muted-foreground)]">
                  Controls the rounding applied to buttons, inputs, and tiles.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={resetToDefaults} disabled={saving}>
                Reset to defaults
              </Button>
              <Button type="submit" disabled={!canSave}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </CardFooter>
          </Card>
        </form>

        <Card className="overflow-hidden">
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--agui-on-surface)]">Live preview</h2>
              <p className="mt-1 text-sm text-[var(--agui-muted-foreground)]">
                Tokens update in real time so you can confirm contrast and shapes before saving.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-[var(--agui-radius)] border border-[color:color-mix(in_srgb,_var(--agui-card-border)_70%,_transparent)] bg-[var(--agui-card)] p-5 shadow-soft transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--agui-muted-foreground)]">Orders today</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--agui-on-surface)]">128</p>
                    <p className="mt-1 text-sm text-[var(--agui-muted-foreground)]">Up 18% vs yesterday</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-[var(--agui-primary)] px-3 py-1 text-xs font-medium text-[var(--agui-on-primary)]">
                    Live
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button className="min-w-[140px]">Primary action</Button>
                <Button variant="ghost" className="min-w-[140px]">
                  Secondary
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loadState === "loading" && (
        <div className="text-sm text-[var(--agui-muted-foreground)]">Loading saved appearance…</div>
      )}
    </div>
  );
}

export default AppearanceEditor;
