"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { WorkspaceSettings } from "@/lib/settings/workspace";
import type { WorkspaceSettingsUpdateValues } from "@/lib/settings/workspace-update";

const textareaClassName =
  "w-full min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm" +
  " outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground" +
  " focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" +
  " disabled:cursor-not-allowed disabled:opacity-50";

type FormState = {
  labels: {
    house: string;
    branch: string;
    pass: string;
    discounts: {
      loyalty: string;
      wholesale: string;
      manual: string;
      promo: string;
    };
  };
  receipt: {
    footerText: string;
    showTotalSavings: boolean;
    printProfile: string;
  };
  sop: {
    startShiftHint: string;
    blindDropHint: string;
    cashierVarianceThresholds: { small: string; medium: string; large: string };
  };
  pos: {
    blindDropEnabled: boolean;
    overagePoolEnabled: boolean;
    overagePoolMaxOffsetRatio: string;
  };
  ui: {
    alwaysShowStartBusinessTile: boolean;
  };
};

function toFormState(settings: WorkspaceSettings): FormState {
  return {
    labels: {
      house: settings.labels.house,
      branch: settings.labels.branch,
      pass: settings.labels.pass,
      discounts: {
        loyalty: settings.labels.discounts.loyalty,
        wholesale: settings.labels.discounts.wholesale,
        manual: settings.labels.discounts.manual,
        promo: settings.labels.discounts.promo,
      },
    },
    receipt: {
      footerText: settings.receipt.footerText,
      showTotalSavings: settings.receipt.showTotalSavings,
      printProfile: settings.receipt.printProfile,
    },
    sop: {
      startShiftHint: settings.sop.startShiftHint,
      blindDropHint: settings.sop.blindDropHint,
      cashierVarianceThresholds: {
        small: String(settings.sop.cashierVarianceThresholds.small ?? ""),
        medium: String(settings.sop.cashierVarianceThresholds.medium ?? ""),
        large: String(settings.sop.cashierVarianceThresholds.large ?? ""),
      },
    },
    pos: {
      blindDropEnabled: settings.pos.blindDropEnabled,
      overagePoolEnabled: settings.pos.overagePool.enabled,
      overagePoolMaxOffsetRatio: String(settings.pos.overagePool.maxOffsetRatio ?? ""),
    },
    ui: {
      alwaysShowStartBusinessTile: settings.ui.alwaysShowStartBusinessTile,
    },
  } satisfies FormState;
}

function stringOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function buildPayload(state: FormState, reset: boolean): { values: WorkspaceSettingsUpdateValues; error?: string } {
  if (reset) {
    return {
      values: {
        labels: {
          house: null,
          branch: null,
          pass: null,
          discounts: { loyalty: null, wholesale: null, manual: null, promo: null },
        },
        receipt: { footerText: null, showTotalSavings: null, printProfile: null },
        sop: { startShiftHint: null, blindDropHint: null, cashierVarianceThresholds: null },
        pos: { blindDropEnabled: null, overagePool: { enabled: null, maxOffsetRatio: null } },
        ui: { alwaysShowStartBusinessTile: null },
      },
    };
  }

  const toNumber = (value: string): number | null | "invalid" => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : "invalid";
  };

  const small = toNumber(state.sop.cashierVarianceThresholds.small);
  const medium = toNumber(state.sop.cashierVarianceThresholds.medium);
  const large = toNumber(state.sop.cashierVarianceThresholds.large);
  const thresholdsCleared =
    state.sop.cashierVarianceThresholds.small.trim() === "" &&
    state.sop.cashierVarianceThresholds.medium.trim() === "" &&
    state.sop.cashierVarianceThresholds.large.trim() === "";

  let thresholdPayload: WorkspaceSettingsUpdateValues["sop"] extends { cashierVarianceThresholds?: infer T }
    ? T
    : never;
  if (thresholdsCleared) {
    thresholdPayload = null as never;
  } else if (small === "invalid" || medium === "invalid" || large === "invalid") {
    return { values: {}, error: "Variance thresholds must be numeric." };
  } else {
    thresholdPayload = { small: small as number | null, medium: medium as number | null, large: large as number | null } as never;
  }

  const overageRatio = toNumber(state.pos.overagePoolMaxOffsetRatio);
  const overageCleared = state.pos.overagePoolMaxOffsetRatio.trim() === "";
  if (overageRatio === "invalid") {
    return { values: {}, error: "Overage pool offset must be a number." };
  }

  return {
    values: {
      labels: {
        house: stringOrNull(state.labels.house),
        branch: stringOrNull(state.labels.branch),
        pass: stringOrNull(state.labels.pass),
        discounts: {
          loyalty: stringOrNull(state.labels.discounts.loyalty),
          wholesale: stringOrNull(state.labels.discounts.wholesale),
          manual: stringOrNull(state.labels.discounts.manual),
          promo: stringOrNull(state.labels.discounts.promo),
        },
      },
      receipt: {
        footerText: stringOrNull(state.receipt.footerText),
        showTotalSavings: state.receipt.showTotalSavings,
        printProfile: stringOrNull(state.receipt.printProfile),
      },
      sop: {
        startShiftHint: stringOrNull(state.sop.startShiftHint),
        blindDropHint: stringOrNull(state.sop.blindDropHint),
        cashierVarianceThresholds: thresholdsCleared ? null : thresholdPayload,
      },
      pos: {
        blindDropEnabled: state.pos.blindDropEnabled,
        overagePool: {
          enabled: state.pos.overagePoolEnabled,
          maxOffsetRatio: overageCleared ? null : (overageRatio as number | null),
        },
      },
      ui: { alwaysShowStartBusinessTile: state.ui.alwaysShowStartBusinessTile },
    },
  };
}

type WorkspaceSettingsFormProps = {
  businessSlug: string;
  initialValues: WorkspaceSettings;
  canEdit: boolean;
};

export default function WorkspaceSettingsForm({
  businessSlug,
  initialValues,
  canEdit,
}: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(() => toFormState(initialValues));
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm(toFormState(initialValues));
  }, [initialValues]);

  const disabled = saving || !canEdit;

  const submit = React.useCallback(
    async (reset: boolean) => {
      setSaving(true);
      setError(null);
      setStatus("idle");

      const payload = buildPayload(form, reset);
      if (payload.error) {
        setSaving(false);
        setStatus("error");
        setError(payload.error);
        return;
      }

      try {
        const res = await fetch(`/company/${businessSlug}/settings/workspace`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        const body = (await res.json().catch(() => ({}))) as { settings?: WorkspaceSettings; error?: { message?: string } };
        if (!res.ok) {
          setStatus("error");
          setError(body?.error?.message || "Unable to save settings.");
          setSaving(false);
          return;
        }

        if (body.settings) {
          setForm(toFormState(body.settings));
        }
        setStatus("success");
        setSaving(false);
        router.refresh();
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unable to save settings.");
        setStatus("error");
        setSaving(false);
      }
    },
    [businessSlug, form, router],
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
    >
      {!canEdit && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You can preview settings, but only workspace owners or admins can make changes.
        </div>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">Labels</h2>
            <p className="text-sm text-muted-foreground">How your workspace names key concepts across the product.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Workspace label</label>
              <Input
                value={form.labels.house}
                onChange={(event) => setForm((prev) => ({ ...prev, labels: { ...prev.labels, house: event.target.value } }))}
                placeholder="house"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Branch label</label>
              <Input
                value={form.labels.branch}
                onChange={(event) => setForm((prev) => ({ ...prev, labels: { ...prev.labels, branch: event.target.value } }))}
                placeholder="branch"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Pass label</label>
              <Input
                value={form.labels.pass}
                onChange={(event) => setForm((prev) => ({ ...prev, labels: { ...prev.labels, pass: event.target.value } }))}
                placeholder="pass"
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Loyalty discount</label>
                <Input
                  value={form.labels.discounts.loyalty}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      labels: { ...prev.labels, discounts: { ...prev.labels.discounts, loyalty: event.target.value } },
                    }))
                  }
                  placeholder="Loyalty"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Wholesale discount</label>
                <Input
                  value={form.labels.discounts.wholesale}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      labels: { ...prev.labels, discounts: { ...prev.labels.discounts, wholesale: event.target.value } },
                    }))
                  }
                  placeholder="Wholesale"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Manual discount</label>
                <Input
                  value={form.labels.discounts.manual}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      labels: { ...prev.labels, discounts: { ...prev.labels.discounts, manual: event.target.value } },
                    }))
                  }
                  placeholder="Manual"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Promo discount</label>
                <Input
                  value={form.labels.discounts.promo}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      labels: { ...prev.labels, discounts: { ...prev.labels.discounts, promo: event.target.value } },
                    }))
                  }
                  placeholder="Promo"
                  disabled={disabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">Receipt defaults</h2>
            <p className="text-sm text-muted-foreground">What customers see on receipts and invoices.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Footer text</label>
              <textarea
                className={textareaClassName}
                value={form.receipt.footerText}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, receipt: { ...prev.receipt, footerText: event.target.value } }))
                }
                placeholder="Thank you for shopping!"
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Show total savings</p>
                <p className="text-xs text-muted-foreground">Display a savings line item on receipts.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.receipt.showTotalSavings}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    receipt: { ...prev.receipt, showTotalSavings: event.target.checked },
                  }))
                }
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Printer profile</label>
              <Input
                value={form.receipt.printProfile}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, receipt: { ...prev.receipt, printProfile: event.target.value } }))
                }
                placeholder="thermal80"
                disabled={disabled}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">SOP & cashiering</h2>
            <p className="text-sm text-muted-foreground">Helpful context for shift flows.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Start shift hint</label>
              <textarea
                className={textareaClassName}
                value={form.sop.startShiftHint}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sop: { ...prev.sop, startShiftHint: event.target.value } }))
                }
                placeholder="Capture the float you received at the beginning of your shift."
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Blind drop hint</label>
              <textarea
                className={textareaClassName}
                value={form.sop.blindDropHint}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sop: { ...prev.sop, blindDropHint: event.target.value } }))
                }
                placeholder="Enter the denominations you counted at the end of your shift."
                disabled={disabled}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Variance thresholds (pesos)</p>
              <p className="text-xs text-muted-foreground">Small / medium / large variance guidance for verifiers.</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Input
                  value={form.sop.cashierVarianceThresholds.small}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sop: {
                        ...prev.sop,
                        cashierVarianceThresholds: {
                          ...prev.sop.cashierVarianceThresholds,
                          small: event.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="5"
                  inputMode="decimal"
                  disabled={disabled}
                />
                <Input
                  value={form.sop.cashierVarianceThresholds.medium}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sop: {
                        ...prev.sop,
                        cashierVarianceThresholds: {
                          ...prev.sop.cashierVarianceThresholds,
                          medium: event.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="15"
                  inputMode="decimal"
                  disabled={disabled}
                />
                <Input
                  value={form.sop.cashierVarianceThresholds.large}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sop: {
                        ...prev.sop,
                        cashierVarianceThresholds: {
                          ...prev.sop.cashierVarianceThresholds,
                          large: event.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="30"
                  inputMode="decimal"
                  disabled={disabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="text-lg font-semibold">POS defaults</h2>
            <p className="text-sm text-muted-foreground">Flags that influence POS and cashiering behavior.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Blind drops</p>
                <p className="text-xs text-muted-foreground">Allow blind end-of-shift submissions.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.pos.blindDropEnabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, pos: { ...prev.pos, blindDropEnabled: event.target.checked } }))
                }
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Overage pool</p>
                <p className="text-xs text-muted-foreground">Enable using overage pool to offset shortages.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.pos.overagePoolEnabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, pos: { ...prev.pos, overagePoolEnabled: event.target.checked } }))
                }
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Max overage coverage (ratio)</label>
              <Input
                value={form.pos.overagePoolMaxOffsetRatio}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, pos: { ...prev.pos, overagePoolMaxOffsetRatio: event.target.value } }))
                }
                inputMode="decimal"
                placeholder="0.5"
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">GM UI</p>
                <p className="text-xs text-muted-foreground">Always show the Start a business tile for GMs.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.ui.alwaysShowStartBusinessTile}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, ui: { alwaysShowStartBusinessTile: event.target.checked } }))
                }
                disabled={disabled}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={disabled} onClick={() => submit(false)}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => submit(true)}>
          Reset to defaults
        </Button>
        {status === "success" && <span className="text-sm text-emerald-700">Saved.</span>}
        {status === "error" && !error && <span className="text-sm text-destructive">Unable to save.</span>}
      </div>
    </form>
  );
}
