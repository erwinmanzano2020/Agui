"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  SETTINGS_CATALOG,
  SETTINGS_BY_KEY,
  type SettingDefinition,
  type SettingKey,
  type SettingValueForKey,
} from "@/lib/settings/catalog";
import type { SettingScope } from "@/lib/settings/types";
import { resetSettingAction, saveSettingAction } from "./actions";
import PreviewPanel from "./PreviewPanel";

type SettingSnapshot = {
  value: unknown;
  source: SettingScope;
};

type SnapshotByCategory = Record<string, Record<string, SettingSnapshot>>;

type WorkspaceProps = {
  scope: SettingScope;
  categories: string[];
  effectiveSnapshots: SnapshotByCategory;
  gmSnapshots: SnapshotByCategory;
  businessId?: string | null;
  branchId?: string | null;
};

type DraftState = Record<string, unknown>;

type FieldState = {
  definition: SettingDefinition;
  snapshot: SettingSnapshot;
  gm: SettingSnapshot;
};

function settingLabelFromKey(key: string) {
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  return last
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

  function toJsonString(value: unknown) {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value ? "true" : "false";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }

  function parseJsonInput(raw: string) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  function valuesMatch(a: unknown, b: unknown) {
    if (typeof a === "object" || typeof b === "object") {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return a === b;
  }

export default function CentralizedSettingsWorkspace(props: WorkspaceProps) {
  const router = useRouter();
  const { scope, categories, effectiveSnapshots, gmSnapshots, businessId, branchId } = props;
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "receipt");
  const [draft, setDraft] = useState<DraftState>({});
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categoryFields = useMemo(() => {
    const definitions = SETTINGS_CATALOG.filter((entry) => entry.category === activeCategory);
    return definitions.map<FieldState>((definition) => {
      const snapshot = effectiveSnapshots[activeCategory]?.[definition.key as SettingKey] ?? {
        value: definition.defaultValue,
        source: "GM" as SettingScope,
      };
      const gm = gmSnapshots[activeCategory]?.[definition.key as SettingKey] ?? {
        value: definition.defaultValue,
        source: "GM" as SettingScope,
      };
      return { definition, snapshot, gm };
    });
  }, [activeCategory, effectiveSnapshots, gmSnapshots]);

  const unsavedKeys = Object.keys(draft);
  const hasUnsaved = unsavedKeys.length > 0;

  async function handleSave() {
    if (!hasUnsaved) return;
    setErrorMessage(null);
    startTransition(async () => {
      try {
        for (const key of unsavedKeys) {
          const typedKey = key as SettingKey;
          if (!SETTINGS_BY_KEY[typedKey]) {
            continue;
          }
          const value = draft[key] as SettingValueForKey<typeof typedKey>;
          await saveSettingAction({
            key: typedKey,
            scope,
            value,
            businessId: businessId ?? undefined,
            branchId: branchId ?? undefined,
          });
        }
        setDraft({});
        router.refresh();
      } catch (error) {
        console.error("settings save", error);
        setErrorMessage(error instanceof Error ? error.message : "Failed to save settings");
      }
    });
  }

  function handleDiscard() {
    setDraft({});
    setErrorMessage(null);
  }

  async function handleReset(key: string) {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const typedKey = key as SettingKey;
        await resetSettingAction({
          key: typedKey,
          scope,
          businessId: businessId ?? undefined,
          branchId: branchId ?? undefined,
        });
        setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        router.refresh();
      } catch (error) {
        console.error("settings reset", error);
        setErrorMessage(error instanceof Error ? error.message : "Failed to reset setting");
      }
    });
  }

  function handleValueChange(definition: SettingDefinition, raw: unknown, baseline: unknown) {
    setDraft((current) => {
      const next = { ...current };
      if (valuesMatch(raw, baseline)) {
        delete next[definition.key];
      } else {
        next[definition.key] = raw;
      }
      return next;
    });
  }

  const previewEffective = useMemo(
    () => effectiveSnapshots[activeCategory] ?? {},
    [activeCategory, effectiveSnapshots],
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex w-full flex-col gap-4 lg:w-2/3">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-3 py-1 text-sm ${activeCategory === category ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 bg-white"}`}
            >
              {category.replace(/\./g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
            </button>
          ))}
        </div>

        {errorMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {hasUnsaved ? (
          <div className="flex flex-wrap items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>Unsaved changes</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-md bg-blue-600 px-3 py-1 text-white shadow-sm disabled:opacity-60"
              >
                Save all
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="rounded-md border border-neutral-200 px-3 py-1"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {categoryFields.map(({ definition, snapshot, gm }) => {
            const enforced = Boolean((definition.meta as { enforced?: boolean }).enforced);
            const pendingValue = draft[definition.key];
            const currentValue = pendingValue ?? snapshot.value;
            return (
              <div
                key={definition.key}
                className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium">{settingLabelFromKey(definition.key)}</h3>
                    <p className="text-sm text-neutral-500">{definition.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${snapshot.source === "GM" ? "bg-slate-100 text-slate-700" : snapshot.source === "BUSINESS" ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}
                    >
                      Source: {snapshot.source}
                    </span>
                    {snapshot.source !== "GM" ? (
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => handleReset(definition.key)}
                        disabled={isPending || enforced}
                      >
                        Reset to default
                      </button>
                    ) : null}
                    {enforced ? <span title="Locked by GM policy">🔒</span> : null}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {definition.type === "boolean" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(currentValue)}
                        onChange={(event) =>
                          handleValueChange(definition, event.target.checked, snapshot.value)
                        }
                        disabled={enforced}
                      />
                      <span>{Boolean(currentValue) ? "Enabled" : "Disabled"}</span>
                    </label>
                  ) : null}

                  {definition.type === "string" ? (
                    <input
                      type="text"
                      value={String(currentValue ?? "")}
                      onChange={(event) =>
                        handleValueChange(definition, event.target.value, snapshot.value)
                      }
                      disabled={enforced}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    />
                  ) : null}

                  {definition.type === "number" ? (
                    <input
                      type="number"
                      value={Number(currentValue ?? 0)}
                      onChange={(event) =>
                        handleValueChange(definition, Number(event.target.value), snapshot.value)
                      }
                      disabled={enforced}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    />
                  ) : null}

                  {definition.type === "json" ? (
                    <textarea
                      value={typeof currentValue === "string" ? currentValue : toJsonString(currentValue)}
                      onChange={(event) =>
                        handleValueChange(
                          definition,
                          parseJsonInput(event.target.value),
                          snapshot.value,
                        )
                      }
                      rows={6}
                      disabled={enforced}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm font-mono"
                    />
                  ) : null}

                  {pendingValue !== undefined ? (
                    <p className="text-xs text-blue-600">Pending override</p>
                  ) : null}

                  {gm ? (
                    <p className="text-xs text-neutral-500">Global default: {toJsonString(gm.value)}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full lg:w-1/3">
        <PreviewPanel
          category={activeCategory}
          effectiveValues={previewEffective}
          globalValues={gmSnapshots[activeCategory] ?? {}}
          draft={draft}
          scope={scope}
        />
      </div>
    </div>
  );
}
