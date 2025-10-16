"use server";

import { getSupabase } from "@/lib/supabase";
import { DEFAULT_THEME, ThemeConfig } from "@/lib/theme";

const ROW_ID = "default";

export async function getTheme(): Promise<ThemeConfig> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("agui_theme")
    .select("primary_hsl, accent_hsl, radius_px")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    console.error("[agui_theme] getTheme error:", error);
    return DEFAULT_THEME;
  }
  if (!data) return DEFAULT_THEME;
  return {
    primary_hsl: data.primary_hsl ?? DEFAULT_THEME.primary_hsl,
    accent_hsl: data.accent_hsl ?? DEFAULT_THEME.accent_hsl,
    radius_px: Number.isFinite(data.radius_px) ? data.radius_px : DEFAULT_THEME.radius_px,
  };
}

export async function setTheme(next: ThemeConfig) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("agui_theme")
    .upsert({
      id: ROW_ID,
      primary_hsl: next.primary_hsl,
      accent_hsl: next.accent_hsl,
      radius_px: next.radius_px,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[agui_theme] setTheme error:", error);
    throw new Error(error.message);
  }
}
