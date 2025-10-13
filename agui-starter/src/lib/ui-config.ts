// agui-starter/src/lib/ui-config.ts
import { getSupabase } from "./supabase";

export type UiTheme = {
  primary_hex: string;
  surface: string;
  accent: string;
  radius: number;
};

export type UiToggles = {
  payroll: boolean;
  employees: boolean;
  shifts: boolean;
  pos: boolean;
};

export type UiConfig = {
  theme: UiTheme;
  toggles: UiToggles;
};

const DEFAULT: UiConfig = {
  theme: {
    primary_hex: "#3c7cae",
    surface: "#0b0b0b",
    accent: "#06b6d4",
    radius: 12,
  },
  toggles: { payroll: true, employees: true, shifts: true, pos: false },
};

export async function loadUiConfig(): Promise<UiConfig> {
  const sb = getSupabase();
  if (!sb) {
    console.warn("Supabase not available; using default UI config.");
    return DEFAULT;
  }

  const [{ data: themeRows, error: tErr }, { data: toggleRows, error: gErr }] =
    await Promise.all([
      sb.from("agui_theme_view").select("primary_hex,surface,accent,radius").limit(1),
      sb.from("agui_toggles").select("payroll,employees,shifts,pos").eq("id", 1).limit(1),
    ]);

  if (tErr || gErr) {
    console.warn("UI config query error:", tErr ?? gErr);
    return DEFAULT;
  }

  const theme = themeRows?.[0];
  const toggles = toggleRows?.[0];

  if (!theme || !toggles) return DEFAULT;

  return { theme, toggles };
}
