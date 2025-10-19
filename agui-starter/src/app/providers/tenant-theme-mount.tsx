"use client";

import { useEffect } from "react";

import { getSupabase } from "@/lib/supabase";
import { DEFAULT_PRESET, THEME_PRESETS, hexToHslTriplet } from "@/lib/theme-presets";

const ROW_ID = "default";

function applyWallpaper(slug: string | null | undefined) {
  const root = document.documentElement;
  if (slug) {
    root.style.setProperty("--wallpaper-url", `url('/wallpapers/${slug}.svg')`);
  } else {
    root.style.setProperty("--wallpaper-url", "none");
  }
}

function applyAccent(hex: string | null | undefined) {
  if (!hex) return;
  const root = document.documentElement;
  const hsl = hexToHslTriplet(hex);
  const accent = `hsl(${hsl})`;

  root.style.setProperty("--agui-accent-hsl", hsl);
  root.style.setProperty("--agui-accent", accent);
  root.style.setProperty("--agui-primary-hsl", hsl);
  root.style.setProperty("--agui-primary", accent);
  root.style.setProperty("--agui-ring-hsl", hsl);
  root.style.setProperty("--agui-ring", accent);
}

function applyTokens(params: {
  presetName: string | null | undefined;
  iconContainerHex?: string | null;
  labelHex?: string | null;
  accentHex?: string | null;
  ringOpacity?: number | null;
  wallpaper?: string | null;
}) {
  const root = document.documentElement;

  if (params.iconContainerHex) {
    root.style.setProperty("--tile-bg", params.iconContainerHex);
  }
  if (params.labelHex) {
    root.style.setProperty("--tile-label", params.labelHex);
  }

  applyAccent(params.accentHex ?? undefined);

  if (typeof params.ringOpacity === "number") {
    root.style.setProperty("--agui-ring-alpha", params.ringOpacity.toString());
    root.style.setProperty("--agui-ring-alpha-hover", (params.ringOpacity * 2).toString());
  }

  applyWallpaper(params.wallpaper ?? null);

  if (params.presetName) {
    root.dataset.themePreset = params.presetName;
  }
}

export default function TenantThemeMount() {
  useEffect(() => {
    const preset = THEME_PRESETS.find((entry) => entry.name === DEFAULT_PRESET);
    if (preset?.wallpaper) {
      applyWallpaper(preset.wallpaper);
    }
    document.documentElement.dataset.themePreset = DEFAULT_PRESET;
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("tenant_theme")
        .select(
          "preset_name, icon_container_hex, label_hex, accent_hex, ring_opacity, wallpaper_slug"
        )
        .eq("id", ROW_ID)
        .maybeSingle();

      if (cancelled || error || !data) {
        return;
      }

      applyTokens({
        presetName: data.preset_name,
        iconContainerHex: data.icon_container_hex,
        labelHex: data.label_hex,
        accentHex: data.accent_hex,
        ringOpacity: typeof data.ring_opacity === "number" ? data.ring_opacity : undefined,
        wallpaper: data.wallpaper_slug,
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
