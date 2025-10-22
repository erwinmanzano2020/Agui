"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

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
        (() => {
          const modules = cfg.modules ?? [];
          if (modules.length === 0) {
            return (
              <EmptyState
                title="No modules configured"
                description="Connect to your Agui instance to preview modules here."
              />
            );
          }

          return (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => {
                const label = m.label ?? m.key.replace(/[-_]/g, " ");
                const enabled = Boolean(m.enabled);
                return (
                  <div
                    key={m.key}
                    className={cn(
                      "rounded-2xl border border-border bg-card/60 p-4 text-card-foreground shadow-soft transition-all",
                      enabled ? "hover:shadow-md" : "opacity-80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{label}</h2>
                        <p className="text-sm text-muted-foreground">
                          {enabled ? "Module enabled" : "Module disabled"}
                        </p>
                      </div>
                      <Badge tone={enabled ? "on" : "off"}>
                        {enabled ? "Open" : "Off"}
                      </Badge>
                    </div>
                    {!enabled && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Ask an admin to enable this in Settings → Modules.
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })()
      )}
    </main>
  );
}
