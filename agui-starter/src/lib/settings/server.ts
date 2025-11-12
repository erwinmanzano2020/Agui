"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache, revalidateTag } from "next/cache";

import {
  SETTINGS_BY_KEY,
  SETTINGS_CATALOG,
  SETTING_SCOPE_ORDER,
  type SettingDefinitionForKey,
  type SettingKey,
  type SettingValueForKey,
} from "./catalog";
import type {
  EffectiveSettingResult,
  ResetSettingInput,
  SetSettingInput,
  SettingIdentifier,
  SettingScope,
  SettingType,
  SettingsSnapshotOptions,
  SettingsSnapshotRecord,
} from "./types";

const SETTINGS_TABLE = "settings_values";
const AUDIT_TABLE = "settings_audit";

const SETTINGS_KEY_TAG_PREFIX = "settings:key:";
const SETTINGS_SCOPE_TAG_PREFIX = "settings:scope:";
const SETTINGS_TILE_TAG_PREFIX = "tiles:user:";

function getSupabaseServiceRole(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials not configured for settings helpers");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function serializeValue(value: unknown) {
  return value;
}

function computeScopeComposite(scope: SettingScope, ids: SettingIdentifier) {
  const businessPart = ids.businessId ?? "null";
  const branchPart = ids.branchId ?? "null";
  return `${scope}:biz:${businessPart}:br:${branchPart}`;
}

function computeScopeTag(scope: SettingScope, ids: SettingIdentifier) {
  return `${SETTINGS_SCOPE_TAG_PREFIX}${computeScopeComposite(scope, ids)}`;
}

function computeKeyTag(key: SettingKey) {
  return `${SETTINGS_KEY_TAG_PREFIX}${key}`;
}

function ensureScopeIdentifiers(scope: SettingScope, ids: SettingIdentifier) {
  if (scope === "GM") {
    return { businessId: null, branchId: null };
  }
  if (!ids.businessId) {
    throw new Error(`businessId is required when scope is ${scope}`);
  }
  if (scope === "BRANCH" && !ids.branchId) {
    throw new Error("branchId is required when scope is BRANCH");
  }
  return {
    businessId: ids.businessId,
    branchId: scope === "BRANCH" ? ids.branchId! : null,
  };
}

function coerceValueForKey<K extends SettingKey>(key: K, raw: unknown): SettingValueForKey<K> {
  const definition = SETTINGS_BY_KEY[key] as SettingDefinitionForKey<K>;
  if (raw == null) {
    return definition.defaultValue as SettingValueForKey<K>;
  }

  const type = definition.type as SettingType;
  switch (type) {
    case "boolean":
      if (typeof raw !== "boolean") {
        throw new Error(`Expected boolean value for ${key}`);
      }
      return raw as SettingValueForKey<K>;
    case "string":
      if (typeof raw !== "string") {
        throw new Error(`Expected string value for ${key}`);
      }
      return raw as SettingValueForKey<K>;
    case "number":
      if (typeof raw !== "number") {
        throw new Error(`Expected number value for ${key}`);
      }
      return raw as SettingValueForKey<K>;
    case "json":
      if (typeof raw !== "object") {
        throw new Error(`Expected json object for ${key}`);
      }
      return raw as SettingValueForKey<K>;
    default:
      throw new Error(`Unsupported setting type ${(definition as { type: string }).type}`);
  }
}

function resolveValueForKey<K extends SettingKey>(
  key: K,
  values: Array<{
    scope: SettingScope;
    business_id: string | null;
    branch_id: string | null;
    value: unknown;
  }>,
  identifiers: SettingIdentifier,
): EffectiveSettingResult<SettingValueForKey<K>> {
  const definition = SETTINGS_BY_KEY[key] as SettingDefinitionForKey<K>;
  const businessId = identifiers.businessId ?? null;
  const branchId = identifiers.branchId ?? null;

  for (const scope of SETTING_SCOPE_ORDER) {
    const match = values.find((entry) => {
      if (entry.scope !== scope) return false;
      if (scope === "GM") return true;
      if (scope === "BUSINESS") {
        return entry.business_id === businessId;
      }
      return entry.business_id === businessId && entry.branch_id === branchId;
    });
    if (match) {
      return {
        value: coerceValueForKey(key, match.value),
        source: match.scope,
      };
    }
  }
  return { value: definition.defaultValue as SettingValueForKey<K>, source: "GM" };
}

function buildCacheTags(key: SettingKey, scope: SettingScope, ids: SettingIdentifier) {
  return [computeKeyTag(key), computeScopeTag(scope, ids)];
}

export async function getEffectiveSetting<K extends SettingKey>(
  key: K,
  identifiers: SettingIdentifier = {},
): Promise<EffectiveSettingResult<SettingValueForKey<K>>> {
  const identifiersNormalized: SettingIdentifier = {
    businessId: identifiers.businessId ?? null,
    branchId: identifiers.branchId ?? null,
  };

  const scopeTagScope: SettingScope = identifiersNormalized.branchId
    ? "BRANCH"
    : identifiersNormalized.businessId
      ? "BUSINESS"
      : "GM";

  const cached = unstable_cache(
    async () => {
      const supabase = getSupabaseServiceRole();
      const { data, error } = await supabase
        .from(SETTINGS_TABLE)
        .select("scope,business_id,branch_id,value")
        .eq("key", key);
      if (error) {
        throw new Error(`Failed to load setting ${key}: ${error.message}`);
      }
      return resolveValueForKey(
        key,
        (data ?? []) as Array<{
          scope: SettingScope;
          business_id: string | null;
          branch_id: string | null;
          value: unknown;
        }>,
        identifiersNormalized,
      );
    },
    [
      "settings",
      "effective",
      key,
      identifiersNormalized.businessId ?? "null",
      identifiersNormalized.branchId ?? "null",
    ],
    {
      tags: [computeKeyTag(key), computeScopeTag(scopeTagScope, identifiersNormalized)],
    },
  );

  return cached();
}

export async function getSettingsSnapshot(
  options: SettingsSnapshotOptions,
): Promise<Record<string, SettingsSnapshotRecord<SettingValueForKey<SettingKey>>>> {
  const keys = SETTINGS_CATALOG.filter((entry) => entry.category === options.category).map(
    (entry) => entry.key,
  );

  if (keys.length === 0) {
    return {};
  }

  const identifiers: SettingIdentifier = {
    businessId: options.businessId ?? null,
    branchId: options.branchId ?? null,
  };

  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select("key,scope,business_id,branch_id,value")
    .in("key", keys);
  if (error) {
    throw new Error(`Failed to load settings snapshot: ${error.message}`);
  }

  const result: Record<string, SettingsSnapshotRecord<SettingValueForKey<SettingKey>>> = {};
  for (const key of keys) {
    const scopedValues = (data ?? []).filter((row) => row.key === key);
    const resolved = resolveValueForKey(
      key,
      scopedValues as Array<{
        scope: SettingScope;
        business_id: string | null;
        branch_id: string | null;
        value: unknown;
      }>,
      identifiers,
    );
    result[key] = resolved as SettingsSnapshotRecord<SettingValueForKey<SettingKey>>;
  }
  return result;
}

export async function setSetting<K extends SettingKey>(
  input: SetSettingInput<SettingValueForKey<K>> & { key: K },
  actorEntityId: string | null,
): Promise<void> {
  const definition = SETTINGS_BY_KEY[input.key] as SettingDefinitionForKey<K>;
  const identifiers = ensureScopeIdentifiers(input.scope, input);
  const supabase = getSupabaseServiceRole();
  const validatedValue = coerceValueForKey(input.key, input.value);

  const { data: existingRows, error: loadError } = await supabase
    .from(SETTINGS_TABLE)
    .select("id,value,version")
    .eq("key", input.key)
    .eq("scope", input.scope)
    .eq("business_id", identifiers.businessId)
    .eq("branch_id", identifiers.branchId)
    .limit(1);

  if (loadError) {
    throw new Error(`Failed to load existing setting: ${loadError.message}`);
  }

  const existing = existingRows?.[0];
  const nextVersion = (existing?.version ?? 0) + 1;
  const serializedValue = serializeValue(validatedValue);

  const { error: upsertError } = await supabase.from(SETTINGS_TABLE).upsert(
    {
      key: input.key,
      scope: input.scope,
      business_id: identifiers.businessId,
      branch_id: identifiers.branchId,
      value: serializedValue,
      version: nextVersion,
      updated_by: actorEntityId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "key,scope,business_id,branch_id",
    },
  );

  if (upsertError) {
    throw new Error(`Failed to persist setting: ${upsertError.message}`);
  }

  const { error: auditError } = await supabase.from(AUDIT_TABLE).insert({
    key: input.key,
    scope: input.scope,
    business_id: identifiers.businessId,
    branch_id: identifiers.branchId,
    old_value: existing?.value ?? null,
    new_value: serializedValue,
    changed_by: actorEntityId,
    changed_at: new Date().toISOString(),
  });

  if (auditError) {
    throw new Error(`Failed to write settings audit: ${auditError.message}`);
  }

  const tags = buildCacheTags(input.key, input.scope, identifiers);
  for (const tag of tags) {
    revalidateTag(tag);
  }

  if (definition.key.startsWith("labels.")) {
    revalidateTag(`${SETTINGS_TILE_TAG_PREFIX}${actorEntityId ?? "*"}`);
  }
}

export async function resetSettingToParent<K extends SettingKey>(
  input: ResetSettingInput & { key: K },
  actorEntityId: string | null,
): Promise<void> {
  const identifiers = ensureScopeIdentifiers(input.scope, input);
  const supabase = getSupabaseServiceRole();

  const { data: existingRows, error: fetchError } = await supabase
    .from(SETTINGS_TABLE)
    .select("id,value")
    .eq("key", input.key)
    .eq("scope", input.scope)
    .eq("business_id", identifiers.businessId)
    .eq("branch_id", identifiers.branchId)
    .limit(1);

  if (fetchError) {
    throw new Error(`Failed to load existing setting: ${fetchError.message}`);
  }

  const existing = existingRows?.[0];
  if (!existing) {
    return;
  }

  const { error: deleteError } = await supabase
    .from(SETTINGS_TABLE)
    .delete()
    .eq("key", input.key)
    .eq("scope", input.scope)
    .eq("business_id", identifiers.businessId)
    .eq("branch_id", identifiers.branchId);

  if (deleteError) {
    throw new Error(`Failed to reset setting: ${deleteError.message}`);
  }

  const { error: auditError } = await supabase.from(AUDIT_TABLE).insert({
    key: input.key,
    scope: input.scope,
    business_id: identifiers.businessId,
    branch_id: identifiers.branchId,
    old_value: existing.value,
    new_value: null,
    changed_by: actorEntityId,
    changed_at: new Date().toISOString(),
  });

  if (auditError) {
    throw new Error(`Failed to record reset audit: ${auditError.message}`);
  }

  const tags = buildCacheTags(input.key, input.scope, identifiers);
  for (const tag of tags) {
    revalidateTag(tag);
  }
}

export function computeScopeOptions(ids: SettingIdentifier): SettingScope {
  if (ids.branchId) return "BRANCH";
  if (ids.businessId) return "BUSINESS";
  return "GM";
}

export const __testing = {
  resolveValueForKey,
  coerceValueForKey,
};
