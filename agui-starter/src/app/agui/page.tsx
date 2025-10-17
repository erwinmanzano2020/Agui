"use client";

import { useEffect, useState } from "react";

type UiModule = { key: string; label?: string; enabled: boolean };
type UiConfig = {
  theme?: { brand?: string };
  modules?: UiModule[];
};

export default function AguiPage() {
  const [cfg, setCfg] = useState<UiConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ui/config")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setCfg(data))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Agui</h1>
        {cfg?.theme?.brand && (
          <span className="text-sm opacity-70">Theme: {cfg.theme.brand}</span>
        )}
      </header>

      {err && (
        <p className="text-danger">
          Failed to load UI config: <span className="font-mono">{err}</span>
        </p>
      )}

      {!cfg && !err && <p className="opacity-70">Loading…</p>}

      {cfg && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(cfg.modules ?? [])
            .filter((m) => m.enabled)
            .map((m) => (
              <div
                key={m.key}
                className="rounded-2xl border border-border bg-card text-card-foreground p-4 shadow-sm hover:shadow-md transition"
              >
                <h2 className="font-semibold text-lg">
                  {m.label ?? m.key.replace(/[-_]/g, " ")}
                </h2>
                <p className="text-sm opacity-70">Module enabled</p>
              </div>
            ))}

          {(cfg.modules ?? []).every((m) => !m.enabled) && (
            <p className="opacity-70">
              No modules enabled. Go to <span className="font-mono">/settings</span> to turn modules on.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
