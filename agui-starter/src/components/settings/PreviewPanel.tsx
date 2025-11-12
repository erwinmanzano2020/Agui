"use client";

import { useEffect, useMemo, useState } from "react";

import { SETTINGS_CATALOG } from "@/lib/settings/catalog";
import type { SettingScope } from "@/lib/settings/types";

type SettingSnapshot = {
  value: unknown;
  source: SettingScope;
};

type PreviewPanelProps = {
  category: string;
  effectiveValues: Record<string, SettingSnapshot>;
  globalValues: Record<string, SettingSnapshot>;
  draft: Record<string, unknown>;
  scope: SettingScope;
};

type PreviewTab = "receipt" | "pos" | "email";

const PREVIEW_TABS: Array<{ id: PreviewTab; label: string }> = [
  { id: "receipt", label: "Receipt" },
  { id: "pos", label: "POS Theme" },
  { id: "email", label: "Email/SMS" },
];

const PREVIEW_SCENARIOS = [
  { id: "default", label: "Default basket" },
  { id: "loyalty", label: "Loyalty discount" },
  { id: "wholesale", label: "Wholesale order" },
];

function formatValue(value: unknown) {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function PreviewPanel(props: PreviewPanelProps) {
  const { category, effectiveValues, globalValues, draft, scope } = props;
  const [activeTab, setActiveTab] = useState<PreviewTab>("receipt");
  const [scenario, setScenario] = useState(PREVIEW_SCENARIOS[0].id);
  const [compareMode, setCompareMode] = useState(false);
  const [debouncedDraft, setDebouncedDraft] = useState(draft);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedDraft(draft), 120);
    return () => clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    if (category.startsWith("pos")) {
      setActiveTab("pos");
    } else if (category.startsWith("receipt")) {
      setActiveTab("receipt");
    }
  }, [category]);

  const workingValues = useMemo(() => {
    const merged: Record<string, SettingSnapshot> = { ...effectiveValues };
    for (const [key, value] of Object.entries(debouncedDraft)) {
      const isInCategory = SETTINGS_CATALOG.some(
        (entry) => entry.key === key && entry.category === category,
      );
      if (!isInCategory) continue;
      merged[key] = {
        value,
        source: scope,
      };
    }
    return merged;
  }, [category, debouncedDraft, effectiveValues, scope]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Live Preview</h2>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(event) => setCompareMode(event.target.checked)}
              />
              Compare mode
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          {PREVIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1 text-sm ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-neutral-100"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-600">
          <span>Scenario:</span>
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            className="rounded-md border border-neutral-200 px-2 py-1"
          >
            {PREVIEW_SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && typeof window.print === "function") {
                window.print();
              }
            }}
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
          >
            Print test
          </button>
        </div>

        {compareMode ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <PreviewSurface title="Global" values={globalValues} scenario={scenario} tab={activeTab} />
            <PreviewSurface title="Effective" values={workingValues} scenario={scenario} tab={activeTab} />
          </div>
        ) : (
          <PreviewSurface title="Effective" values={workingValues} scenario={scenario} tab={activeTab} />
        )}
      </div>
    </div>
  );
}

type PreviewSurfaceProps = {
  title: string;
  tab: PreviewTab;
  scenario: string;
  values: Record<string, SettingSnapshot>;
};

function PreviewSurface({ title, tab, scenario, values }: PreviewSurfaceProps) {
  const receiptFooter = values["receipt.footer_text"]?.value ?? "Thank you for shopping!";
  const receiptSavings = values["receipt.show_total_savings"]?.value;
  const printProfile = values["receipt.print_profile"]?.value ?? "thermal80";
  const primaryColor = values["pos.theme.primary_color"]?.value ?? "#004aad";
  const darkMode = Boolean(values["pos.theme.dark_mode"]?.value);
  const loyaltyLabel = String(values["labels.discount.loyalty"]?.value ?? "Loyalty");

  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{title}</span>
        <span className="font-mono text-neutral-400">Scenario: {scenario}</span>
      </div>
      {tab === "receipt" ? (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between font-semibold">
            <span>Subtotal</span>
            <span>₱1,240.00</span>
          </div>
          <div className="flex items-center justify-between text-neutral-500">
            <span>{loyaltyLabel}</span>
            <span>-₱120.00</span>
          </div>
          {receiptSavings ? (
            <div className="flex items-center justify-between text-emerald-600">
              <span>Total savings</span>
              <span>₱150.00</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-dashed pt-2 font-semibold">
            <span>Total</span>
            <span>₱1,120.00</span>
          </div>
          <p className="pt-2 text-center text-xs text-neutral-400">{receiptFooter as string}</p>
          <p className="text-[10px] text-neutral-400">Print profile: {String(printProfile)}</p>
        </div>
      ) : null}

      {tab === "pos" ? (
        <div
          className="rounded-md border border-neutral-200 p-4 text-sm"
          style={{
            backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
            color: darkMode ? "#e2e8f0" : "#1f2937",
          }}
        >
          <div className="flex items-center justify-between">
            <span>Primary button</span>
            <span
              className="rounded-full px-3 py-1 text-xs text-white"
              style={{ backgroundColor: String(primaryColor) }}
            >
              Pay
            </span>
          </div>
          <p className="mt-3 text-xs text-neutral-400">Dark mode: {darkMode ? "Enabled" : "Disabled"}</p>
        </div>
      ) : null}

      {tab === "email" ? (
        <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
          <p className="text-xs uppercase text-neutral-500">Receipt Preview</p>
          <h3 className="mt-2 text-base font-semibold">Your purchase summary</h3>
          <p className="mt-1 text-sm text-neutral-600">Thanks for shopping with us.</p>
          <pre className="mt-3 overflow-x-auto rounded bg-neutral-900 p-2 text-xs text-emerald-200">
{formatValue(values["pos.float_template"]?.value)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
