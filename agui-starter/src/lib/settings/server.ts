import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag, unstable_cache } from "next/cache";

import type { Database, Json } from "@/lib/db.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { emitEvent } from "@/lib/events/server";

import {
  getSettingDefinition,
  listSettingDefinitionsByCategory,
  type SettingDefinition,
  type SettingCategory,
  type SettingKey,
  type SettingScope,
  type SettingType,
  type SettingValueMap,
} from "./catalog";
import type { SettingContext, SettingSnapshotEntry, SettingsSnapshot, SettingWriteInput } from "./types";

const CACHE_REVALIDATE_SECONDS = 30;

function buildScopeTag(scope: SettingScope, businessId?: string | null, branchId?: string | null) {
  return `settings:scope:${scope}:biz:${businessId ?? "null"}:br:${branchId ?? "null"}`;
}

function buildKeyTag(key: SettingKey) {
  return `settings:key:${key}`;
}

type SettingsValueRow = Database["public"]["Tables"]["settings_values"]["Row"];

type SnapshotOptions = {
  category: SettingCategory;
  businessId?: string | null;
  branchId?: string | null;
};

type ScopeCoordinates = {
  businessId: string | null;
  branchId: string | null;
};

type AuditPayload = {
  key: SettingKey;
  scope: SettingScope;
  business_id: string | null;
  branch_id: string | null;
  old_value: Json | null;
  new_value: Json | null;
  changed_by: string | null | undefined;
};

type MutationOptions = {
  client?: SupabaseClient<Database>;
};

function logMetric(event: string, payload: Record<string, unknown>) {
  console.info(`metric#${event}`, payload);
}

async function resolveBranchBusinessId(
  supabase: SupabaseClient<Database>,
  branchId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("branches")
    .select("house_id")
    .eq("id", branchId)
    .maybeSingle<{ house_id: string | null }>();

  if (error) {
    console.warn("Failed to resolve branch to business", error);
    return null;
  }

  return data?.house_id ?? null;
}

async function resolveScopeCoordinates(
  supabase: SupabaseClient<Database>,
  input: { scope: SettingScope; businessId?: string | null; branchId?: string | null },
): Promise<ScopeCoordinates> {
  if (input.scope === "GM") {
    return { businessId: null, branchId: null };
  }

  if (input.scope === "BUSINESS") {
    if (!input.businessId) {
      throw new Error("businessId is required for BUSINESS scope settings");
    }
    return { businessId: input.businessId, branchId: null };
  }

  if (!input.branchId) {
    throw new Error("branchId is required for BRANCH scope settings");
  }

  const derivedBusiness = input.businessId ?? (await resolveBranchBusinessId(supabase, input.branchId));
  if (!derivedBusiness) {
    throw new Error("Unable to resolve business for branch scope setting");
  }

  return { businessId: derivedBusiness, branchId: input.branchId };
}

function coerceValue<K extends SettingKey>(key: K, raw: Json | null): SettingValueMap[K] {
  const definition = getSettingDefinition(key);
  const type = definition.type as SettingType;
  const value = raw ?? null;

  switch (type) {
    case "boolean":
      return (typeof value === "boolean" ? value : Boolean(value)) as SettingValueMap[K];
    case "number":
      if (typeof value === "number") {
        return value as SettingValueMap[K];
      }
      if (typeof value === "string") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return parsed as SettingValueMap[K];
        }
      }
      return Number(definition.defaultValue ?? 0) as SettingValueMap[K];
    case "string":
      return (typeof value === "string" ? value : String(value ?? definition.defaultValue)) as SettingValueMap[K];
    case "json":
    default:
      return ((value ?? definition.defaultValue) as Json) as SettingValueMap[K];
  }
}

function isValidValue<K extends SettingKey>(key: K, value: unknown): value is SettingValueMap[K] {
  const definition = getSettingDefinition(key);
  const type = definition.type as SettingType;
  switch (type) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
      return typeof value === "string";
    case "json":
      return value === null || typeof value === "object";
    default:
      return false;
  }
}

async function writeAuditEntry(
  supabase: SupabaseClient<Database>,
  payload: AuditPayload,
): Promise<void> {
  const record = { ...payload, changed_by: payload.changed_by ?? null };
  const { error } = await supabase.from("settings_audit").insert(record);
  if (error) {
    console.warn("Failed to write settings audit", error);
  }
}

function buildSnapshotFromRows(
  definitions: SettingDefinition[],
  rows: SettingsValueRow[],
  options: { businessId: string | null; branchId: string | null },
): SettingsSnapshot {
  const snapshot: SettingsSnapshot = {};

  for (const definition of definitions) {
    const key = definition.key;
    const branchMatch = options.branchId
      ? rows.find((row) => row.key === key && row.scope === "BRANCH" && row.branch_id === options.branchId)
      : null;
    const businessMatch = options.businessId
      ? rows.find((row) => row.key === key && row.scope === "BUSINESS" && row.business_id === options.businessId)
      : null;
    const gmMatch = rows.find((row) => row.key === key && row.scope === "GM");

    if (branchMatch) {
      snapshot[key] = {
        key,
        value: coerceValue(key, branchMatch.value),
        source: "BRANCH",
      } satisfies SettingSnapshotEntry;
      continue;
    }
    if (businessMatch) {
      snapshot[key] = {
        key,
        value: coerceValue(key, businessMatch.value),
        source: "BUSINESS",
      } satisfies SettingSnapshotEntry;
      continue;
    }
    if (gmMatch) {
      snapshot[key] = {
        key,
        value: coerceValue(key, gmMatch.value),
        source: "GM",
      } satisfies SettingSnapshotEntry;
      continue;
    }

    snapshot[key] = {
      key,
      value: definition.defaultValue as SettingValueMap[typeof key],
      source: "GM",
    } satisfies SettingSnapshotEntry;
  }

  return snapshot;
}

async function maybeRevalidateTiles(
  supabase: SupabaseClient<Database>,
  key: SettingKey,
  actorEntityId?: string | null,
) {
  if (!actorEntityId) {
    return;
  }
  if (!key.startsWith("labels.")) {
    return;
  }

  const { data, error } = await supabase
    .from("entities")
    .select("profile")
    .eq("id", actorEntityId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>();

  if (error) {
    console.warn("Failed to resolve auth user id for tiles revalidation", error);
    return;
  }

  const profile = data?.profile ?? null;
  const userId =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as { auth_user_id?: unknown }).auth_user_id
      : null;
  if (typeof userId === "string" && userId) {
    await emitEvent(`tiles:user:${userId}`, "invalidate", { reason: "settings updated", key });
  }
}

export async function getSettingsSnapshot(options: SnapshotOptions): Promise<SettingsSnapshot> {
  const { category } = options;
  const businessId = options.businessId ?? null;
  const branchId = options.branchId ?? null;

  const definitions = listSettingDefinitionsByCategory(category);
  const tags = new Set<string>();
  tags.add(buildScopeTag("GM", null, null));
  for (const definition of definitions) {
    tags.add(buildKeyTag(definition.key));
  }
  if (businessId) {
    tags.add(buildScopeTag("BUSINESS", businessId, null));
  }
  if (branchId) {
    tags.add(buildScopeTag("BRANCH", businessId ?? null, branchId));
  }

  const loader = unstable_cache(
    async () => {
      const supabase = await createServerSupabaseClient();
      const keys = definitions.map((definition) => definition.key);
      if (keys.length === 0) {
        return {} satisfies SettingsSnapshot;
      }

      const { data, error } = await supabase
        .from("settings_values")
        .select("key,scope,business_id,branch_id,value")
        .in("key", keys);

      if (error) {
        console.warn("Failed to load settings snapshot", error);
        return {} satisfies SettingsSnapshot;
      }

      const rows = (data ?? []) as SettingsValueRow[];
      return buildSnapshotFromRows(definitions, rows, { businessId, branchId });
    },
    ["settings", "snapshot", category, businessId ?? "null", branchId ?? "null"],
    { tags: Array.from(tags), revalidate: CACHE_REVALIDATE_SECONDS },
  );

  const start = performance.now();
  const result = await loader();
  const duration = Math.round(performance.now() - start);
  logMetric("settings_preview_render_ms", { category, duration });
  return result;
}

export async function getEffectiveSetting<K extends SettingKey>(
  key: K,
  context: SettingContext = {},
): Promise<SettingValueMap[K]> {
  const definition = getSettingDefinition(key);
  const snapshot = await getSettingsSnapshot({
    category: definition.category,
    businessId: context.businessId,
    branchId: context.branchId,
  });
  const resolved = snapshot[key];
  return (resolved?.value ?? definition.defaultValue) as SettingValueMap[K];
}

async function mutateSetting(
  input: SettingWriteInput,
  actorEntityId?: string | null,
  action: "set" | "reset" = "set",
  options: MutationOptions = {},
): Promise<void> {
  const supabase = options.client ?? (await createServerSupabaseClient());
  const coordinates = await resolveScopeCoordinates(supabase, input);
  const key = input.key;
  const scope = input.scope;

  const match = {
    key,
    scope,
    business_id: coordinates.businessId,
    branch_id: coordinates.branchId,
  } satisfies Partial<SettingsValueRow>;

  const existing = await supabase
    .from("settings_values")
    .select("id,value,version")
    .match(match)
    .maybeSingle<{ id: string; value: Json; version: number }>();

  if (action === "reset") {
    if (!existing.data) {
      return;
    }
    const { error: deleteError } = await supabase.from("settings_values").delete().eq("id", existing.data.id);
    if (deleteError) {
      throw deleteError;
    }
    await writeAuditEntry(supabase, {
      key,
      scope,
      business_id: coordinates.businessId,
      branch_id: coordinates.branchId,
      old_value: existing.data.value,
      new_value: null,
      changed_by: actorEntityId,
    });
    revalidateTag(buildKeyTag(key));
    revalidateTag(buildScopeTag(scope, coordinates.businessId, coordinates.branchId));
    logMetric("settings_reset_count", { key, scope });
    await maybeRevalidateTiles(supabase, key, actorEntityId);
    return;
  }

  if (!isValidValue(key, input.value)) {
    throw new Error(`Invalid value for ${key}`);
  }

  const nextVersion = (existing.data?.version ?? 0) + 1;
  const payload = {
    ...match,
    value: input.value as Json,
    version: nextVersion,
    updated_by: actorEntityId ?? null,
  } satisfies Partial<SettingsValueRow> & { value: Json; version: number };

  const { error } = await supabase
    .from("settings_values")
    .upsert(payload, { onConflict: "key,scope,business_id,branch_id" });
  if (error) {
    throw error;
  }

  await writeAuditEntry(supabase, {
    key,
    scope,
    business_id: coordinates.businessId,
    branch_id: coordinates.branchId,
    old_value: existing.data?.value ?? null,
    new_value: payload.value,
    changed_by: actorEntityId,
  });

  revalidateTag(buildKeyTag(key));
  revalidateTag(buildScopeTag(scope, coordinates.businessId, coordinates.branchId));
  logMetric("settings_write_count", { key, scope });
  await maybeRevalidateTiles(supabase, key, actorEntityId);
}

export async function setSetting(
  input: SettingWriteInput,
  actorEntityId?: string | null,
): Promise<void> {
  await mutateSetting(input, actorEntityId, "set");
}

export async function resetSettingToParent(
  input: Omit<SettingWriteInput, "value">,
  actorEntityId?: string | null,
): Promise<void> {
  if (input.scope === "GM") {
    throw new Error("GM scope cannot be reset");
  }
  await mutateSetting(input as SettingWriteInput, actorEntityId, "reset");
}

export const __settingsTesting = {
  buildSnapshotFromRows,
  coerceValue,
  isValidValue,
  mutateSettingWithClient: (
    client: SupabaseClient<Database>,
    input: SettingWriteInput,
    actorEntityId: string,
    action: "set" | "reset" = "set",
  ) => mutateSetting(input, actorEntityId, action, { client }),
};
