import "server-only";

import { getSettingsSnapshot } from "@/lib/settings/server";
import type { SettingCategory, SettingKey } from "@/lib/settings/catalog";
import type { SettingsSnapshot } from "@/lib/settings/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WorkspaceSettings = {
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
    cashierVarianceThresholds: { small: number; medium: number; large: number };
  };
  pos: {
    blindDropEnabled: boolean;
    overagePool: { enabled: boolean; maxOffsetRatio: number };
    floatDefaults: Record<string, number>;
  };
  ui: {
    alwaysShowStartBusinessTile: boolean;
  };
  branding: {
    brandName: string | null;
    logoUrl: string | null;
  };
};

export const WORKSPACE_SETTINGS_DEFAULTS: WorkspaceSettings = {
  labels: {
    house: "house",
    branch: "branch",
    pass: "pass",
    discounts: {
      loyalty: "Loyalty",
      wholesale: "Wholesale",
      manual: "Manual",
      promo: "Promo",
    },
  },
  receipt: {
    footerText: "Thank you for shopping!",
    showTotalSavings: true,
    printProfile: "thermal80",
  },
  sop: {
    startShiftHint: "Capture the float you received at the beginning of your shift.",
    blindDropHint: "Enter the denominations you counted at the end of your shift.",
    cashierVarianceThresholds: { small: 5, medium: 15, large: 30 },
  },
  pos: {
    blindDropEnabled: true,
    overagePool: { enabled: true, maxOffsetRatio: 0.5 },
    floatDefaults: {},
  },
  ui: {
    alwaysShowStartBusinessTile: false,
  },
  branding: {
    brandName: null,
    logoUrl: null,
  },
};

type WorkspaceSnapshotBundle = {
  labels: SettingsSnapshot;
  receipt: SettingsSnapshot;
  sop: SettingsSnapshot;
  pos: SettingsSnapshot;
  ui: SettingsSnapshot;
  branding: WorkspaceSettings["branding"];
};

type SnapshotLoader = (
  category: SettingCategory,
  context: { businessId: string; branchId: string | null },
) => Promise<SettingsSnapshot>;

type BrandingLoader = (businessId: string) => Promise<WorkspaceSettings["branding"]>;

function pickString(snapshot: SettingsSnapshot, key: SettingKey, fallback: string) {
  const value = snapshot[key]?.value;
  return typeof value === "string" ? value : fallback;
}

function pickBoolean(snapshot: SettingsSnapshot, key: SettingKey, fallback: boolean) {
  const value = snapshot[key]?.value;
  return typeof value === "boolean" ? value : fallback;
}

function pickNumber(snapshot: SettingsSnapshot, key: SettingKey, fallback: number) {
  const value = snapshot[key]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pickThresholds(
  snapshot: SettingsSnapshot,
  key: SettingKey,
  fallback: WorkspaceSettings["sop"]["cashierVarianceThresholds"],
) {
  const value = snapshot[key]?.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const casted = value as Record<string, unknown>;
    const small = typeof casted.small === "number" ? casted.small : fallback.small;
    const medium = typeof casted.medium === "number" ? casted.medium : fallback.medium;
    const large = typeof casted.large === "number" ? casted.large : fallback.large;
    return { small, medium, large } as WorkspaceSettings["sop"]["cashierVarianceThresholds"];
  }
  return fallback;
}

function pickNumberMap(snapshot: SettingsSnapshot, key: SettingKey, fallback: Record<string, number>) {
  const value = snapshot[key]?.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const casted = value as Record<string, unknown>;
    const entries = Object.entries(casted).reduce<Record<string, number>>((acc, [denom, count]) => {
      if (typeof count === "number" && Number.isFinite(count)) {
        acc[denom] = count;
      }
      return acc;
    }, {});

    if (Object.keys(entries).length > 0) {
      return entries;
    }
  }

  return fallback;
}

export function normalizeWorkspaceSettings(bundle: WorkspaceSnapshotBundle): WorkspaceSettings {
  const base = structuredClone(WORKSPACE_SETTINGS_DEFAULTS);

  return {
    labels: {
      house: pickString(bundle.labels, "labels.house", base.labels.house),
      branch: pickString(bundle.labels, "labels.branch", base.labels.branch),
      pass: pickString(bundle.labels, "labels.pass", base.labels.pass),
      discounts: {
        loyalty: pickString(bundle.labels, "labels.discount.loyalty", base.labels.discounts.loyalty),
        wholesale: pickString(bundle.labels, "labels.discount.wholesale", base.labels.discounts.wholesale),
        manual: pickString(bundle.labels, "labels.discount.manual", base.labels.discounts.manual),
        promo: pickString(bundle.labels, "labels.discount.promo", base.labels.discounts.promo),
      },
    },
    receipt: {
      footerText: pickString(bundle.receipt, "receipt.footer_text", base.receipt.footerText),
      showTotalSavings: pickBoolean(bundle.receipt, "receipt.show_total_savings", base.receipt.showTotalSavings),
      printProfile: pickString(bundle.receipt, "receipt.print_profile", base.receipt.printProfile),
    },
    sop: {
      startShiftHint: pickString(bundle.sop, "sop.start_shift_hint", base.sop.startShiftHint),
      blindDropHint: pickString(bundle.sop, "sop.blind_drop_hint", base.sop.blindDropHint),
      cashierVarianceThresholds: pickThresholds(
        bundle.sop,
        "sop.cashier_variance_thresholds",
        base.sop.cashierVarianceThresholds,
      ),
    },
    pos: {
      blindDropEnabled: pickBoolean(bundle.pos, "pos.cash.blind_drop_enabled", base.pos.blindDropEnabled),
      overagePool: {
        enabled: pickBoolean(bundle.pos, "pos.cash.overage_pool.enabled", base.pos.overagePool.enabled),
        maxOffsetRatio: pickNumber(
          bundle.pos,
          "pos.cash.overage_pool.max_offset_ratio",
          base.pos.overagePool.maxOffsetRatio,
        ),
      },
      floatDefaults: pickNumberMap(bundle.pos, "pos.cash.float.defaults", base.pos.floatDefaults),
    },
    ui: {
      alwaysShowStartBusinessTile: pickBoolean(
        bundle.ui,
        "gm.ui.always_show_start_business_tile",
        base.ui.alwaysShowStartBusinessTile,
      ),
    },
    branding: {
      brandName: bundle.branding.brandName ?? base.branding.brandName,
      logoUrl: bundle.branding.logoUrl ?? base.branding.logoUrl,
    },
  };
}



async function loadWorkspaceBranding(businessId: string): Promise<WorkspaceSettings["branding"]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("houses")
    .select("brand_name,logo_url")
    .eq("id", businessId)
    .maybeSingle<{ brand_name?: string | null; logo_url?: string | null }>();

  if (error) {
    console.warn("Failed to load workspace branding", error);
    return WORKSPACE_SETTINGS_DEFAULTS.branding;
  }

  return {
    brandName: data?.brand_name ?? null,
    logoUrl: data?.logo_url ?? null,
  };
}
function logMetric(event: string, payload: Record<string, unknown>) {
  console.info(`metric#${event}`, payload);
}

export async function loadWorkspaceSettings(businessId: string): Promise<WorkspaceSettings> {
  return loadWorkspaceSettingsWithLoader(
    businessId,
    async (category, context) =>
      getSettingsSnapshot({ category, businessId: context.businessId, branchId: context.branchId }),
    loadWorkspaceBranding,
  );
}

export async function loadWorkspaceSettingsWithLoader(
  businessId: string,
  loader: SnapshotLoader,
  brandingLoader: BrandingLoader = async () => WORKSPACE_SETTINGS_DEFAULTS.branding,
): Promise<WorkspaceSettings> {
  const branchId = businessId;
  const start = performance.now();

  try {
    const [labels, receipt, sop, pos, ui, branding] = await Promise.all([
      loader("labels", { businessId, branchId }),
      loader("receipt", { businessId, branchId }),
      loader("sop", { businessId, branchId }),
      loader("pos", { businessId, branchId }),
      loader("ui", { businessId, branchId }),
      brandingLoader(businessId),
    ]);

    const normalized = normalizeWorkspaceSettings({ labels, receipt, sop, pos, ui, branding });
    logMetric("settings_workspace_load_ms", { businessId, duration: Math.round(performance.now() - start) });
    return normalized;
  } catch (error) {
    console.warn("Failed to load workspace settings", error);
    logMetric("settings_workspace_load_ms", { businessId, duration: Math.round(performance.now() - start), error: true });
    return WORKSPACE_SETTINGS_DEFAULTS;
  }
}

export const __workspaceSettingsTesting = { normalizeWorkspaceSettings, loadWorkspaceSettingsWithLoader } as const;
