"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type Theme = {
  primary?: string;
  surface?: string;
  accent?: string;
  radius?: number;
};
type Toggles = {
  payroll?: boolean;
  employees?: boolean;
  shifts?: boolean;
  pos?: boolean;
};

export default function AguiHubPage() {
  const [theme, setTheme] = useState<Theme>({});
  const [toggles, setToggles] = useState<Toggles>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    (async () => {
      const [{ data: t1 }, { data: t2 }] = await Promise.all([
        sb.from("agui_theme").select("primary,surface,accent,radius").single(),
        sb.from("agui_toggles").select("payroll,employees,shifts,pos").single(),
      ]);

      if (t1) setTheme(t1 as Theme);
      if (t2) setToggles(t2 as Toggles);
      setLoading(false);
    })();
  }, []);

  // Apply CSS custom props (minimal)
  useEffect(() => {
    const root = document.documentElement;
    if (theme.primary) root.style.setProperty("--agui-primary", theme.primary);
    if (theme.surface) root.style.setProperty("--agui-surface", theme.surface);
    if (theme.accent) root.style.setProperty("--agui-accent", theme.accent);
    if (typeof theme.radius === "number") {
      root.style.setProperty("--agui-radius", `${theme.radius}px`);
    }
  }, [theme]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agui Hub</h1>
        <Link className="btn btn-ghost" href="/settings">
          Settings
        </Link>
      </div>

      {loading ? (
        <div className="card p-6">Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ModuleCard
            title="Payroll"
            enabled={!!toggles.payroll}
            href="/payroll"
          />
          <ModuleCard
            title="Employees"
            enabled={!!toggles.employees}
            href="/employees"
          />
          <ModuleCard title="Shifts" enabled={!!toggles.shifts} href="/shifts" />
          <ModuleCard title="POS" enabled={!!toggles.pos} href="/pos" />
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  title,
  enabled,
  href,
}: {
  title: string;
  enabled: boolean;
  href: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--agui-surface,#0b0b0b)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <span
          className={
            "px-2 py-0.5 rounded text-xs " +
            (enabled ? "bg-green-500/15 text-green-500" : "bg-zinc-500/15 text-zinc-400")
          }
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <Link
        href={enabled ? href : "#"}
        className={"btn " + (enabled ? "btn-primary" : "btn-ghost pointer-events-none opacity-50")}
        style={{ borderRadius: "var(--agui-radius, 12px)" }}
      >
        Open
      </Link>
    </div>
  );
}
