"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  listSettingDefinitions,
  listSettingDefinitionsByCategory,
  SETTING_CATEGORIES,
  type SettingCategory,
  type SettingKey,
  type SettingScope,
  type SettingValueMap,
} from "@/lib/settings/catalog";
import type { SettingContext, SettingsSnapshot } from "@/lib/settings/types";
import PreviewPanel from "@/components/settings/PreviewPanel";

const CATEGORY_LABELS: Record<SettingCategory, string> = {
  receipt: "Receipts",
  pos: "POS",
  labels: "Labels",
  sop: "SOP",
  email: "Email",
  preview: "Preview",
};

type SnapshotByCategory = Record<SettingCategory, SettingsSnapshot>;

type Props = {
  scope: SettingScope;
  snapshots: SnapshotByCategory;
  globalSnapshots: SnapshotByCategory;
  context: SettingContext;
};

type StatusState = { message: string; variant: "success" | "error" } | null;

const API_ROUTES = {
  set: "/api/settings/set",
  reset: "/api/settings/reset",
  snapshot: "/api/settings/snapshot",
};

function deriveInitialDraftValues(snapshots: SnapshotByCategory): Partial<Record<SettingKey, SettingValueMap[SettingKey]>> {
  const map: Partial<Record<SettingKey, SettingValueMap[SettingKey]>> = {};
  for (const category of SETTING_CATEGORIES) {
    const snapshot = snapshots[category] ?? {};
    for (const definition of listSettingDefinitionsByCategory(category)) {
      const entry = snapshot[definition.key];
      map[definition.key] = (entry?.value ?? definition.defaultValue) as SettingValueMap[typeof definition.key];
    }
  }
  return map;
}

function serializeValue(value: unknown, type: string): string {
  if (type === "json") {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return "{}";
    }
  }
  return typeof value === "undefined" || value === null ? "" : String(value);
}

export default function SettingsWorkbench({ scope, snapshots, globalSnapshots, context }: Props) {
  const [activeCategory, setActiveCategory] = useState<SettingCategory>(SETTING_CATEGORIES[0]!);
  const [localSnapshots, setLocalSnapshots] = useState<SnapshotByCategory>(snapshots);
  const [draftValues, setDraftValues] = useState<Partial<Record<SettingKey, SettingValueMap[SettingKey]>>>(() =>
    deriveInitialDraftValues(snapshots),
  );
  const [dirtyKeys, setDirtyKeys] = useState<Set<SettingKey>>(new Set());
  const [status, setStatus] = useState<StatusState>(null);
  const [errors, setErrors] = useState<Partial<Record<SettingKey, string | null>>>({});
  const [isPending, startTransition] = useTransition();
  const [previewSnapshot, setPreviewSnapshot] = useState<SettingsSnapshot>(() =>
    buildCombinedSnapshot(snapshots, draftValues, new Set(), scope),
  );

  useEffect(() => {
    setLocalSnapshots(snapshots);
  }, [snapshots]);

  useEffect(() => {
    const combined = buildCombinedSnapshot(localSnapshots, draftValues, dirtyKeys, scope);
    const handle = setTimeout(() => setPreviewSnapshot(combined), 120);
    return () => clearTimeout(handle);
  }, [localSnapshots, draftValues, dirtyKeys, scope]);

  const hasUnsavedChanges = dirtyKeys.size > 0;
  const definitions = listSettingDefinitionsByCategory(activeCategory);

  useEffect(() => {
    setDraftValues(deriveInitialDraftValues(localSnapshots));
    setDirtyKeys(new Set());
  }, [localSnapshots]);

  function updateDirtyState(key: SettingKey, nextValue: SettingValueMap[SettingKey]) {
    const next = new Set(dirtyKeys);
    const snapshotEntry = snapshotsByKey(localSnapshots)[key];
    const baseValue = snapshotEntry?.value ?? listSettingDefinitions().find((def) => def.key === key)?.defaultValue;
    if (JSON.stringify(baseValue) === JSON.stringify(nextValue)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setDirtyKeys(next);
  }

  function handleChange(key: SettingKey, value: SettingValueMap[SettingKey]) {
    setDraftValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: null }));
    updateDirtyState(key, value);
    setStatus(null);
  }

  function handleJsonChange(key: SettingKey, raw: string) {
    try {
      const parsed = raw.trim().length === 0 ? {} : JSON.parse(raw);
      handleChange(key, parsed as SettingValueMap[typeof key]);
    } catch {
      setErrors((prev) => ({ ...prev, [key]: "Invalid JSON" }));
    }
  }

  async function refreshCategory(category: SettingCategory) {
    const params = new URLSearchParams({ category });
    if (context.businessId) params.append("businessId", context.businessId);
    if (context.branchId) params.append("branchId", context.branchId);
    const response = await fetch(`${API_ROUTES.snapshot}?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to refresh settings");
    }
    const body = (await response.json()) as { data: SettingsSnapshot };
    const nextSnapshots = { ...localSnapshots, [category]: body.data } as SnapshotByCategory;
    setLocalSnapshots(nextSnapshots);
    setDraftValues(deriveInitialDraftValues(nextSnapshots));
    setDirtyKeys(new Set());
    setStatus({ message: "Synced latest settings", variant: "success" });
  }

  async function saveChanges() {
    if (!hasUnsavedChanges) return;
    setStatus(null);
    startTransition(async () => {
      try {
        for (const key of dirtyKeys) {
          const value = draftValues[key];
          const response = await fetch(API_ROUTES.set, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
              scope,
              value,
              businessId: context.businessId,
              branchId: context.branchId,
            }),
          });
          if (!response.ok) {
            throw new Error(`Failed to save ${key}`);
          }
        }
        await refreshCategory(activeCategory);
        setStatus({ message: "Settings saved", variant: "success" });
      } catch (error) {
        console.error(error);
        setStatus({ message: "Failed to save settings", variant: "error" });
      }
    });
  }

  function discardChanges() {
    setDraftValues(deriveInitialDraftValues(localSnapshots));
    setDirtyKeys(new Set());
    setStatus({ message: "Discarded pending edits", variant: "success" });
  }

  async function resetKey(key: SettingKey) {
    setStatus(null);
    startTransition(async () => {
      try {
        const response = await fetch(API_ROUTES.reset, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            scope,
            businessId: context.businessId,
            branchId: context.branchId,
          }),
        });
        if (!response.ok) {
          throw new Error(`Failed to reset ${key}`);
        }
        await refreshCategory(activeCategory);
      } catch (error) {
        console.error(error);
        setStatus({ message: "Failed to reset setting", variant: "error" });
      }
    });
  }

  const globalCombined = useMemo(
    () => buildCombinedSnapshot(globalSnapshots, {}, new Set(), "GM"),
    [globalSnapshots],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {SETTING_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-3 py-1 text-sm ${
                activeCategory === category
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {CATEGORY_LABELS[category] ?? category}
            </button>
          ))}
        </div>
        {hasUnsavedChanges && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You have {dirtyKeys.size} unsaved change{dirtyKeys.size > 1 ? "s" : ""}. Save or discard before leaving this page.
          </div>
        )}
        {status && (
          <div
            className={`rounded-lg px-4 py-2 text-sm ${
              status.variant === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {status.message}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={saveChanges}
            disabled={!hasUnsavedChanges || isPending}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Save all
          </button>
          <button
            type="button"
            onClick={discardChanges}
            disabled={!hasUnsavedChanges || isPending}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
          >
            Discard
          </button>
        </div>
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          {definitions.map((definition) => {
            const snapshotEntry = localSnapshots[activeCategory]?.[definition.key];
            const value = draftValues[definition.key];
            const enforced = Boolean((definition.meta as { enforced?: boolean })?.enforced);
            const showReset = scope !== "GM" && snapshotEntry && snapshotEntry.source !== "GM";
            return (
              <div key={definition.key} className="space-y-2 border-b border-border/60 pb-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{definition.description}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    Source: {snapshotEntry?.source ?? "GM"}
                  </span>
                  {enforced && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span aria-hidden>🔒</span>
                      Locked by GM policy
                    </span>
                  )}
                  {showReset && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => resetKey(definition.key)}
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                {renderField(definition.key, definition.type, value, (definition.meta as Record<string, unknown>) ?? {}, (next) =>
                  definition.type === "json"
                    ? handleJsonChange(definition.key, next as string)
                    : handleChange(definition.key, next as SettingValueMap[typeof definition.key]),
                )}
                {errors[definition.key] && (
                  <p className="text-xs text-destructive">{errors[definition.key]}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <PreviewPanel scope={scope} effectiveSnapshot={previewSnapshot} globalSnapshot={globalCombined} />
    </div>
  );
}

function renderField(
  key: SettingKey,
  type: string,
  value: SettingValueMap[SettingKey] | undefined,
  meta: Record<string, unknown>,
  onChange: (next: SettingValueMap[SettingKey] | string) => void,
) {
  switch (type) {
    case "boolean":
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked as SettingValueMap[typeof key])}
          />
          <span>Enabled</span>
        </label>
      );
    case "number":
      return (
        <input
          type="number"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={serializeValue(value ?? 0, type)}
          onChange={(event) => onChange(Number(event.target.value) as SettingValueMap[typeof key])}
        />
      );
    case "json":
      return (
        <textarea
          className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
          value={serializeValue(value ?? {}, type)}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    default:
      if (Array.isArray(meta.options)) {
        return (
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={serializeValue(value, type)}
            onChange={(event) => onChange(event.target.value as SettingValueMap[typeof key])}
          >
            {(meta.options as string[]).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      }
      return (
        <input
          type="text"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={serializeValue(value, type)}
          maxLength={typeof meta.maxLength === "number" ? meta.maxLength : undefined}
          onChange={(event) => onChange(event.target.value as SettingValueMap[typeof key])}
        />
      );
  }
}

function buildCombinedSnapshot(
  source: SnapshotByCategory,
  drafts: Partial<Record<SettingKey, SettingValueMap[SettingKey]>>,
  dirtyKeys: Set<SettingKey>,
  scope: SettingScope,
): SettingsSnapshot {
  const combined: SettingsSnapshot = {};
  const allDefinitions = listSettingDefinitions();
  for (const definition of allDefinitions) {
    const base = source[definition.category]?.[definition.key];
    if (dirtyKeys.has(definition.key) && typeof drafts[definition.key] !== "undefined") {
      combined[definition.key] = {
        key: definition.key,
        value: drafts[definition.key] as SettingValueMap[typeof definition.key],
        source: scope,
      };
      continue;
    }
    if (base) {
      combined[definition.key] = base;
      continue;
    }
    combined[definition.key] = {
      key: definition.key,
      value: definition.defaultValue as SettingValueMap[typeof definition.key],
      source: "GM",
    };
  }
  return combined;
}

function snapshotsByKey(source: SnapshotByCategory): SettingsSnapshot {
  const map: SettingsSnapshot = {};
  for (const category of SETTING_CATEGORIES) {
    const snapshot = source[category] ?? {};
    for (const key of Object.keys(snapshot) as SettingKey[]) {
      map[key] = snapshot[key];
    }
  }
  return map;
}
