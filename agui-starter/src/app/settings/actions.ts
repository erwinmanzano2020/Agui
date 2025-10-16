"use server";

import { getSupabase } from "@/lib/supabase";
import { DEFAULT_THEME, type ThemeConfig } from "@/lib/theme";

const ROW_ID = "default";

export async function getTheme(): Promise<ThemeConfig> {
  const supabase = getSupabase();
  if (!supabase) {
    // Supabase not configured — fall back to defaults
    return DEFAULT_THEME;
  }

  const { data, error } = await supabase
    .from("agui_theme")
    .select("primary_hsl, accent_hsl, radius_px")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_THEME;
  }

  return {
    primary_hsl: data.primary_hsl ?? DEFAULT_THEME.primary_hsl,
    accent_hsl: data.accent_hsl ?? DEFAULT_THEME.accent_hsl,
    radius_px:
      typeof data.radius_px === "number" && Number.isFinite(data.radius_px)
        ? data.radius_px
        : DEFAULT_THEME.radius_px,
  };
}

export async function setTheme(next: ThemeConfig) {
  const supabase = getSupabase();
  if (!supabase) {
    // No Supabase → skip persistence; UI already applied optimistically
    return;
  }

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
    // surface as a proper error so the caller can toast
    throw new Error(error.message);
  }
}
