"use client";

import * as React from "react";

import { applyPreset } from "@/app/settings/presets-actions";
import { Button } from "@/components/ui/button";
import { THEME_PRESETS, hexToHslTriplet } from "@/lib/theme-presets";

export default function PresetSwatches() {
  const [busy, setBusy] = React.useState<string | null>(null);

  async function onPick(name: string) {
    const preset = THEME_PRESETS.find((entry) => entry.name === name);
    if (!preset) return;

    const root = document.documentElement;
    setBusy(name);

    try {
      if (preset.iconContainerHex) root.style.setProperty("--tile-bg", preset.iconContainerHex);
      if (preset.labelHex) root.style.setProperty("--tile-label", preset.labelHex);

      if (preset.accentHex) {
        const accentHsl = hexToHslTriplet(preset.accentHex);
        root.style.setProperty("--agui-accent-hsl", accentHsl);
        root.style.setProperty("--agui-accent", `hsl(${accentHsl})`);
        root.style.setProperty("--agui-primary-hsl", accentHsl);
        root.style.setProperty("--agui-primary", `hsl(${accentHsl})`);
        root.style.setProperty("--agui-ring-hsl", accentHsl);
        root.style.setProperty("--agui-ring", `hsl(${accentHsl})`);
      }

      root.style.setProperty("--agui-ring-alpha", "0.14");
      root.style.setProperty("--agui-ring-alpha-hover", "0.28");

      if (preset.wallpaper) {
        root.style.setProperty("--wallpaper-url", `url('/wallpapers/${preset.wallpaper}.svg')`);
      } else {
        root.style.setProperty("--wallpaper-url", "none");
      }

      await applyPreset(name);
      root.dataset.themePreset = preset.name;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
      {THEME_PRESETS.map((preset) => (
        <Button
          key={preset.name}
          variant="outline"
          className="h-24 flex flex-col items-center justify-center gap-2"
          onClick={() => onPick(preset.name)}
          disabled={busy === preset.name}
        >
          <div
            className="h-[60px] w-[60px] rounded-[18px]"
            style={{
              background: preset.iconContainerHex ?? "var(--tile-bg)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.14)",
            }}
            aria-hidden
          />
          <span className="text-[13px] tracking-wide font-medium opacity-90">
            {busy === preset.name ? "…" : preset.name}
          </span>
        </Button>
      ))}
    </div>
  );
}
