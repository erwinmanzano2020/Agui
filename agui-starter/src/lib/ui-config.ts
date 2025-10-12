"use server";

import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  assertPublicEnvOnServer,
} from "./env";

export type ThemeConfig = {
  primary_hex: string;
  surface: string;
  accent: string;
  radius: number;
};

export type FeatureToggleKey = "payroll" | "employees" | "shifts" | "pos";

export type FeatureToggles = Record<FeatureToggleKey, boolean>;

export type UiConfig = {
  theme: ThemeConfig;
  toggles: FeatureToggles;
};

const FALLBACK_THEME: ThemeConfig = {
  primary_hex: "#3c7cae",
  surface: "#0b0b0b",
  accent: "#06b6d4",
  radius: 12,
};

const FALLBACK_TOGGLES: FeatureToggles = {
  payroll: true,
  employees: true,
  shifts: true,
  pos: true,
};

type ThemeRow = Partial<ThemeConfig> & {
  primary_hex?: string | null;
  surface?: string | null;
  accent?: string | null;
  radius?: number | null;
};

type ToggleRow = Partial<Record<FeatureToggleKey, boolean | null | number | string>>;

async function fetchUiConfig(): Promise<UiConfig> {
  try {
    assertPublicEnvOnServer();
  } catch (error) {
    console.warn("UI config env validation failed", error);
    return { theme: FALLBACK_THEME, toggles: FALLBACK_TOGGLES };
  }

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { theme: FALLBACK_THEME, toggles: FALLBACK_TOGGLES };
  }

  const client = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { "x-application": "agui-ui-config" } },
  });

  const [themeRes, togglesRes] = await Promise.all([
    client.from("agui_theme_view").select("primary_hex, surface, accent, radius").maybeSingle(),
    client.from("agui_toggles").select("payroll, employees, shifts, pos").eq("id", 1).maybeSingle(),
  ]);

  const themeRow: ThemeRow | null = themeRes.data ?? null;
  const toggleRow: ToggleRow | null = togglesRes.data ?? null;

  const theme: ThemeConfig = {
    primary_hex: themeRow?.primary_hex ?? FALLBACK_THEME.primary_hex,
    surface: themeRow?.surface ?? FALLBACK_THEME.surface,
    accent: themeRow?.accent ?? FALLBACK_THEME.accent,
    radius:
      themeRow?.radius != null && !Number.isNaN(themeRow.radius)
        ? Number(themeRow.radius)
        : FALLBACK_THEME.radius,
  };

  const toggles: FeatureToggles = {
    payroll: coerceBoolean(toggleRow?.payroll, FALLBACK_TOGGLES.payroll),
    employees: coerceBoolean(toggleRow?.employees, FALLBACK_TOGGLES.employees),
    shifts: coerceBoolean(toggleRow?.shifts, FALLBACK_TOGGLES.shifts),
    pos: coerceBoolean(toggleRow?.pos, FALLBACK_TOGGLES.pos),
  };

  return { theme, toggles };
}

function coerceBoolean(value: ToggleRow[keyof ToggleRow], fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "t" || normalized === "1") return true;
    if (normalized === "false" || normalized === "f" || normalized === "0") return false;
  }
  return fallback;
}

export const loadUiConfig = cache(fetchUiConfig);
