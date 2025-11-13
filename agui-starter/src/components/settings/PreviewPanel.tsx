"use client";

import { useMemo, useState } from "react";

import type { SettingKey, SettingScope } from "@/lib/settings/catalog";
import type { SettingsSnapshot } from "@/lib/settings/types";

const TABS = [
  { id: "receipt", label: "Receipt" },
  { id: "pos", label: "POS Theme" },
  { id: "messaging", label: "Email/SMS" },
] as const;

const SCENARIOS = [
  { id: "small_basket", label: "Small basket" },
  { id: "bulk_wholesale", label: "Bulk wholesale" },
  { id: "loyalty_applied", label: "Loyalty applied" },
];

type Props = {
  scope: SettingScope;
  effectiveSnapshot: SettingsSnapshot;
  globalSnapshot: SettingsSnapshot;
};

type ReceiptPreviewModel = {
  title: string;
  items: Array<{ name: string; qty: number; price: number; discount?: string }>;
  showSavings: boolean;
  footer: string;
  labels: Record<string, string>;
};

type PosPreviewModel = {
  primaryColor: string;
  darkMode: boolean;
};

type MessagingPreviewModel = {
  subject: string;
  body: string;
  thresholds: Record<string, number>;
};

type PreviewModels = {
  receipt: ReceiptPreviewModel;
  pos: PosPreviewModel;
  messaging: MessagingPreviewModel;
};

function snapshotValue<T>(snapshot: SettingsSnapshot, key: SettingKey, fallback: T): T {
  const entry = snapshot[key];
  return (entry?.value as T) ?? fallback;
}

function buildModels(snapshot: SettingsSnapshot, scenario: string): PreviewModels {
  const baseItems = [
    { name: "Herbal Tea", qty: 2, price: 120 },
    { name: "Ceramic Mug", qty: 1, price: 450 },
  ];
  const loyaltyItems = [
    { name: "Wholesale Beans", qty: 5, price: 180, discount: "wholesale" },
    { name: "Patron Tote", qty: 1, price: 350, discount: "loyalty" },
  ];
  const items = scenario === "bulk_wholesale" ? loyaltyItems : baseItems;
  const labels = {
    loyalty: snapshotValue(snapshot, "labels.discount.loyalty", "Loyalty"),
    wholesale: snapshotValue(snapshot, "labels.discount.wholesale", "Wholesale"),
    manual: snapshotValue(snapshot, "labels.discount.manual", "Manual"),
    promo: snapshotValue(snapshot, "labels.discount.promo", "Promo"),
  } satisfies Record<string, string>;

  return {
    receipt: {
      title: "Preview Mart",
      items,
      showSavings: Boolean(snapshotValue(snapshot, "receipt.show_total_savings", true)),
      footer: snapshotValue(snapshot, "receipt.footer_text", "Thank you for shopping!"),
      labels,
    },
    pos: {
      primaryColor: snapshotValue(snapshot, "pos.theme.primary_color", "#2563eb"),
      darkMode: Boolean(snapshotValue(snapshot, "pos.theme.dark_mode", false)),
    },
    messaging: {
      subject: `Cashier variance update (${scenario})`,
      body: `Hi team, here is a quick digest of today's drawer reconciliation and applied discounts (${labels.loyalty}, ${labels.promo}).`,
      thresholds: snapshotValue(snapshot, "sop.cashier_variance_thresholds", { small: 5, medium: 15, large: 30 }),
    },
  } satisfies PreviewModels;
}

function ReceiptView({ model }: { model: ReceiptPreviewModel }) {
  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-white p-4 text-sm shadow-sm">
      <div>
        <p className="font-semibold text-lg">{model.title}</p>
        <p className="text-xs text-muted-foreground">123 Market Street · 9:41 AM</p>
      </div>
      <div className="space-y-2">
        {model.items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">Qty {item.qty}</p>
            </div>
            <div className="text-right">
              {item.discount && (
                <p className="text-[11px] uppercase tracking-wide text-primary">
                  {model.labels[item.discount] ?? item.discount}
                </p>
              )}
              <p className="font-semibold">₱{(item.price * item.qty).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
      {model.showSavings && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Customer saved ₱137.00 with stacked promos
        </div>
      )}
      <div className="border-t border-dashed border-border pt-3 text-center text-xs text-muted-foreground">
        {model.footer}
      </div>
    </div>
  );
}

function PosView({ model }: { model: PosPreviewModel }) {
  return (
    <div
      className="rounded-xl border border-border/70 p-4 text-sm shadow-sm"
      style={{
        background: model.darkMode ? "#0f172a" : "#f8fafc",
        color: model.darkMode ? "#f1f5f9" : "#0f172a",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">Checkout</p>
        <span className="text-xs uppercase tracking-wide" style={{ color: model.primaryColor }}>
          {model.darkMode ? "Dark" : "Light"}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg bg-white/20 p-3">
          <p className="text-xs uppercase text-muted-foreground">Primary color</p>
          <div className="mt-2 h-8 rounded" style={{ background: model.primaryColor }} />
        </div>
        <div className="rounded-lg bg-white/20 p-3">
          <p className="text-xs uppercase text-muted-foreground">Float template</p>
          <p className="mt-1 text-sm">Tap to edit opening balance</p>
        </div>
      </div>
    </div>
  );
}

function MessagingView({ model }: { model: MessagingPreviewModel }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground">{model.subject}</p>
      <p className="mt-2 text-sm text-muted-foreground">{model.body}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        {Object.entries(model.thresholds).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border/70 px-2 py-3">
            <p className="uppercase tracking-wide text-muted-foreground">{key}</p>
            <p className="text-base font-semibold text-foreground">±{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PreviewPanel({ scope, effectiveSnapshot, globalSnapshot }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("receipt");
  const [scenario, setScenario] = useState<string>(SCENARIOS[0]!.id);
  const [compareMode, setCompareMode] = useState(false);

  const effectiveModel = useMemo(() => buildModels(effectiveSnapshot, scenario), [effectiveSnapshot, scenario]);
  const globalModel = useMemo(() => buildModels(globalSnapshot, scenario), [globalSnapshot, scenario]);

  const views = compareMode
    ? [
        { title: "Global", model: globalModel },
        { title: scope === "GM" ? "GM" : `${scope} effective`, model: effectiveModel },
      ]
    : [{ title: "Live", model: effectiveModel }];

  function triggerPrint(profile: string) {
    if (typeof window !== "undefined" && typeof window.print === "function") {
      console.info(`Printing ${profile} preview`);
      window.print();
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-muted px-2 py-1 text-xs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1 font-semibold ${
                activeTab === tab.id ? "bg-white text-foreground" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          className="rounded-full border border-border bg-background px-3 py-1 text-xs"
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
        >
          {SCENARIOS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              Scenario: {entry.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(event) => setCompareMode(event.target.checked)}
          />
          Compare mode
        </label>
        <div className="ml-auto flex gap-2 text-xs">
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1"
            onClick={() => triggerPrint("thermal80")}
          >
            Print thermal80
          </button>
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1"
            onClick={() => triggerPrint("a4")}
          >
            Print A4
          </button>
        </div>
      </div>
      <div className={`grid gap-4 ${compareMode ? "md:grid-cols-2" : ""}`}>
        {views.map((view) => (
          <div key={view.title} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{view.title}</p>
            {activeTab === "receipt" && <ReceiptView model={view.model.receipt} />}
            {activeTab === "pos" && <PosView model={view.model.pos} />}
            {activeTab === "messaging" && <MessagingView model={view.model.messaging} />}
          </div>
        ))}
      </div>
    </div>
  );
}
