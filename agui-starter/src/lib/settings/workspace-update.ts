import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import { getMyEntityId } from "@/lib/authz/server";
import { isOptionalTableError } from "@/lib/supabase/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeWorkspaceRole, type WorkspaceRole } from "@/lib/workspaces/roles";

import type { SettingKey, SettingValueMap } from "./catalog";
import { resetSettingToParent, setSetting, type SettingsMutationOptions } from "./server";
import type { SettingWriteInput } from "./types";
import { loadWorkspaceSettings, type WorkspaceSettings } from "./workspace";

type WorkspaceSettingOperation = { key: SettingKey; value: SettingValueMap[SettingKey] | null };

type ThresholdFields = { small?: number | null; medium?: number | null; large?: number | null };

export type WorkspaceSettingsUpdateValues = {
  labels?: {
    house?: string | null;
    branch?: string | null;
    pass?: string | null;
    discounts?: {
      loyalty?: string | null;
      wholesale?: string | null;
      manual?: string | null;
      promo?: string | null;
    };
  };
  receipt?: {
    footerText?: string | null;
    showTotalSavings?: boolean | null;
    printProfile?: string | null;
  };
  sop?: {
    startShiftHint?: string | null;
    blindDropHint?: string | null;
    cashierVarianceThresholds?: ThresholdFields | null;
  };
  pos?: {
    blindDropEnabled?: boolean | null;
    overagePool?: { enabled?: boolean | null; maxOffsetRatio?: number | null };
  };
  ui?: {
    alwaysShowStartBusinessTile?: boolean | null;
  };
  branding?: {
    brandName?: string | null;
    logoUrl?: string | null;
  };
};

export class WorkspaceSettingsUpdateError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WorkspaceSettingsUpdateError";
    this.status = status;
  }
}

export type WorkspaceSettingsUpdateOptions = {
  client?: SupabaseClient<Database>;
  actorEntityId?: string | null;
  allowedRoles?: WorkspaceRole[];
  resolveRoles?: () => Promise<WorkspaceRole[]>;
  reload?: boolean;
  writer?: typeof setSetting;
  resetter?: typeof resetSettingToParent;
  writeOptions?: SettingsMutationOptions;
};

export type WorkspaceBrandingUpdateValues = {
  brandName?: string | null;
  logoUrl?: string | null;
};

const DEFAULT_ALLOWED_ROLES: WorkspaceRole[] = ["owner", "manager"];

function normalizeStringValue(value?: string | null): string | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}


function normalizeLogoUrlValue(value?: string | null): string | null | undefined {
  const normalized = normalizeStringValue(value);
  if (typeof normalized === "undefined" || normalized === null) {
    return normalized;
  }

  if (!/^https?:\/\//i.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeBooleanValue(value?: boolean | null): boolean | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  return Boolean(value);
}

function normalizeNumberValue(value?: number | string | null): number | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed === "number" && Number.isFinite(parsed)) {
    return parsed;
  }
  return undefined;
}

function normalizeThresholds(
  value: ThresholdFields | null | undefined,
): { small: number; medium: number; large: number } | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  const small = normalizeNumberValue(value.small ?? undefined);
  const medium = normalizeNumberValue(value.medium ?? undefined);
  const large = normalizeNumberValue(value.large ?? undefined);

  if (small == null || medium == null || large == null) {
    return undefined;
  }

  return { small, medium, large };
}

function pushOperation(
  operations: WorkspaceSettingOperation[],
  key: SettingKey,
  value: string | number | boolean | Record<string, number> | null | undefined,
) {
  if (typeof value === "undefined") return;
  operations.push({ key, value: value as SettingValueMap[typeof key] | null });
}

function buildWorkspaceSettingOperations(values: WorkspaceSettingsUpdateValues): WorkspaceSettingOperation[] {
  const operations: WorkspaceSettingOperation[] = [];

  if (values.labels) {
    pushOperation(operations, "labels.house", normalizeStringValue(values.labels.house));
    pushOperation(operations, "labels.branch", normalizeStringValue(values.labels.branch));
    pushOperation(operations, "labels.pass", normalizeStringValue(values.labels.pass));

    if (values.labels.discounts) {
      pushOperation(operations, "labels.discount.loyalty", normalizeStringValue(values.labels.discounts.loyalty));
      pushOperation(operations, "labels.discount.wholesale", normalizeStringValue(values.labels.discounts.wholesale));
      pushOperation(operations, "labels.discount.manual", normalizeStringValue(values.labels.discounts.manual));
      pushOperation(operations, "labels.discount.promo", normalizeStringValue(values.labels.discounts.promo));
    }
  }

  if (values.receipt) {
    pushOperation(operations, "receipt.footer_text", normalizeStringValue(values.receipt.footerText));
    pushOperation(operations, "receipt.print_profile", normalizeStringValue(values.receipt.printProfile));
    pushOperation(operations, "receipt.show_total_savings", normalizeBooleanValue(values.receipt.showTotalSavings));
  }

  if (values.sop) {
    pushOperation(operations, "sop.start_shift_hint", normalizeStringValue(values.sop.startShiftHint));
    pushOperation(operations, "sop.blind_drop_hint", normalizeStringValue(values.sop.blindDropHint));

    const thresholds = normalizeThresholds(values.sop.cashierVarianceThresholds);
    pushOperation(operations, "sop.cashier_variance_thresholds", thresholds);
  }

  if (values.pos) {
    pushOperation(operations, "pos.cash.blind_drop_enabled", normalizeBooleanValue(values.pos.blindDropEnabled));

    if (values.pos.overagePool) {
      pushOperation(operations, "pos.cash.overage_pool.enabled", normalizeBooleanValue(values.pos.overagePool.enabled));
      pushOperation(
        operations,
        "pos.cash.overage_pool.max_offset_ratio",
        normalizeNumberValue(values.pos.overagePool.maxOffsetRatio),
      );
    }
  }

  if (values.ui) {
    pushOperation(
      operations,
      "gm.ui.always_show_start_business_tile",
      normalizeBooleanValue(values.ui.alwaysShowStartBusinessTile),
    );
  }

  return operations;
}

async function fetchWorkspaceRoles(
  supabase: SupabaseClient<Database>,
  houseId: string,
  entityId: string,
): Promise<WorkspaceRole[]> {
  const { data, error } = await supabase
    .from("house_roles")
    .select("role")
    .eq("house_id", houseId)
    .eq("entity_id", entityId);

  if (error) {
    if (!isOptionalTableError(error)) {
      console.warn("Failed to load workspace roles for settings", error);
    }
    return [];
  }

  return (data ?? [])
    .map((row) => (typeof (row as { role?: string | null }).role === "string" ? row.role : null))
    .filter((role): role is string => Boolean(role))
    .map((role) => normalizeWorkspaceRole(role));
}

async function ensureWorkspaceSettingsAccess(
  houseId: string,
  options: WorkspaceSettingsUpdateOptions,
): Promise<{ supabase: SupabaseClient<Database>; actorEntityId: string; roles: WorkspaceRole[] }> {
  const supabase = options.client ?? (await createServerSupabaseClient());
  const actorEntityId = options.actorEntityId ?? (await getMyEntityId(supabase));
  if (!actorEntityId) {
    throw new WorkspaceSettingsUpdateError(401, "Not authenticated");
  }

  const roles = options.resolveRoles
    ? await options.resolveRoles()
    : await fetchWorkspaceRoles(supabase, houseId, actorEntityId);
  const allowedRoles = new Set(options.allowedRoles ?? DEFAULT_ALLOWED_ROLES);

  const allowed = roles.some((role) => allowedRoles.has(role));
  if (!allowed) {
    throw new WorkspaceSettingsUpdateError(403, "Forbidden");
  }

  return { supabase, actorEntityId, roles };
}

export async function canEditWorkspaceSettings(
  houseId: string,
  options: Omit<WorkspaceSettingsUpdateOptions, "writer" | "resetter" | "reload"> = {},
): Promise<boolean> {
  try {
    await ensureWorkspaceSettingsAccess(houseId, options);
    return true;
  } catch {
    return false;
  }
}

export async function updateWorkspaceSettings(
  houseId: string,
  values: WorkspaceSettingsUpdateValues,
  options: WorkspaceSettingsUpdateOptions = {},
): Promise<WorkspaceSettings | null> {
  const { supabase, actorEntityId } = await ensureWorkspaceSettingsAccess(houseId, options);
  const operations = buildWorkspaceSettingOperations(values);
  const brandingUpdates: { brand_name?: string | null; logo_url?: string | null } = {};

  if (values.branding) {
    const brandName = normalizeStringValue(values.branding.brandName);
    if (typeof brandName !== "undefined") {
      brandingUpdates.brand_name = brandName;
    }

    const logoUrl = normalizeLogoUrlValue(values.branding.logoUrl);
    if (typeof values.branding.logoUrl !== "undefined" && typeof logoUrl === "undefined") {
      throw new WorkspaceSettingsUpdateError(400, "Logo URL must start with http:// or https://");
    }
    if (typeof logoUrl !== "undefined") {
      brandingUpdates.logo_url = logoUrl;
    }
  }

  if (operations.length === 0 && Object.keys(brandingUpdates).length === 0) {
    return options.reload === false ? null : loadWorkspaceSettings(houseId);
  }

  const writer = options.writer ?? setSetting;
  const resetter = options.resetter ?? resetSettingToParent;
  const writeOptions = options.writeOptions ?? { client: supabase };

  for (const op of operations) {
    const scope: SettingWriteInput["scope"] = "BUSINESS";
    const common = { key: op.key, scope, businessId: houseId } satisfies Partial<SettingWriteInput>;

    if (op.value === null) {
      await resetter(common as SettingWriteInput, actorEntityId, writeOptions);
    } else {
      await writer({ ...common, value: op.value } as SettingWriteInput, actorEntityId, writeOptions);
    }
  }

  if (Object.keys(brandingUpdates).length > 0) {
    const { error } = await supabase.from("houses").update(brandingUpdates).eq("id", houseId);
    if (error) {
      throw new WorkspaceSettingsUpdateError(500, "Unable to update branding");
    }
  }

  if (options.reload === false) {
    return null;
  }

  return loadWorkspaceSettings(houseId);
}

export async function updateWorkspaceBranding(
  houseId: string,
  values: WorkspaceBrandingUpdateValues,
  options: Omit<WorkspaceSettingsUpdateOptions, "writer" | "resetter"> = {},
): Promise<WorkspaceSettings["branding"] | null> {
  const { supabase } = await ensureWorkspaceSettingsAccess(houseId, options);
  const brandingUpdates: { brand_name?: string | null; logo_url?: string | null } = {};

  if (typeof values.brandName !== "undefined") {
    brandingUpdates.brand_name = values.brandName;
  }

  if (typeof values.logoUrl !== "undefined") {
    const logoUrl = normalizeLogoUrlValue(values.logoUrl);
    if (typeof logoUrl === "undefined") {
      throw new WorkspaceSettingsUpdateError(400, "Logo URL must start with http:// or https://");
    }
    brandingUpdates.logo_url = logoUrl;
  }

  if (Object.keys(brandingUpdates).length === 0) {
    return options.reload === false ? null : loadWorkspaceSettings(houseId).then((settings) => settings.branding);
  }

  const { error } = await supabase.from("houses").update(brandingUpdates).eq("id", houseId);
  if (error) {
    throw new WorkspaceSettingsUpdateError(500, "Unable to update branding");
  }

  if (options.reload === false) {
    return null;
  }

  const settings = await loadWorkspaceSettings(houseId);
  return settings.branding;
}

export const __workspaceSettingsUpdateTesting = {
  buildWorkspaceSettingOperations,
  normalizeStringValue,
  normalizeThresholds,
  normalizeLogoUrlValue,
};
