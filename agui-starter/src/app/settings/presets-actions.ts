"use server";

import { getSupabase } from "@/lib/supabase";
import { DEFAULT_PRESET, THEME_PRESETS, type PresetKey } from "@/lib/theme-presets";

const ROW_ID = "default";

function assertPreset(name: string): PresetKey {
  const preset = THEME_PRESETS.find((entry) => entry.name === name);
  if (!preset) {
    throw new Error("Unknown preset");
  }
  return preset.name;
}

export async function applyPreset(name: string) {
  const presetName = assertPreset(name);
  const preset = THEME_PRESETS.find((entry) => entry.name === presetName)!;
  const supabase = getSupabase();

  const updates: Record<string, string | number> = {
    id: ROW_ID,
    preset_name: presetName,
    updated_at: new Date().toISOString(),
    ring_opacity: 0.14,
  };

  if (preset.iconContainerHex) updates.icon_container_hex = preset.iconContainerHex;
  if (preset.labelHex) updates.label_hex = preset.labelHex;
  if (preset.accentHex) updates.accent_hex = preset.accentHex;
  if (preset.wallpaper) updates.wallpaper_slug = preset.wallpaper;

  if (!supabase) {
    return { preset: presetName } as const;
  }

  const { error } = await supabase.from("tenant_theme").upsert(updates, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }

  return { preset: presetName } as const;
}

export function getDefaultPreset() {
  return DEFAULT_PRESET;
}
