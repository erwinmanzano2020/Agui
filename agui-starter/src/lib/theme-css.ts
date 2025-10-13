import type { ThemeConfig } from "@/lib/ui-config";

type ThemeVars = Record<string, string>;

type RGB = { r: number; g: number; b: number };

const DEFAULT_SURFACE = "#0b0b0b";
const DEFAULT_ACCENT_LIGHTEN = 0.24;
const DEFAULT_RADIUS = 12;

export function themeToCssVars(theme: ThemeConfig): ThemeVars {
  const radius = DEFAULT_RADIUS;
  const primary = normalizeHex(theme.primary);
  const surface = normalizeHex(DEFAULT_SURFACE);
  const accent = mixColors(primary, "#ffffff", DEFAULT_ACCENT_LIGHTEN);

  const surfaceIsDark = isDark(surface);
  const primaryOn = getReadableText(primary);
  const surfaceOn = getReadableText(surface);
  const accentOn = getReadableText(accent);

  const cardBg = mixColors(surface, surfaceIsDark ? "#ffffff" : "#000000", surfaceIsDark ? 0.14 : 0.06);
  const cardBorder = mixColors(surface, surfaceIsDark ? "#ffffff" : "#000000", surfaceIsDark ? 0.3 : 0.16);
  const elevatedSurface = mixColors(surface, surfaceIsDark ? "#ffffff" : "#000000", surfaceIsDark ? 0.12 : 0.08);
  const subtleBorder = mixColors(surface, surfaceIsDark ? "#ffffff" : "#000000", surfaceIsDark ? 0.22 : 0.2);
  const mutedForeground = mixColors(surfaceOn, surface, 0.2);

  return {
    "--agui-primary": primary,
    "--agui-surface": surface,
    "--agui-accent": accent,
    "--agui-radius": `${radius}px`,
    "--agui-on-primary": primaryOn,
    "--agui-on-surface": surfaceOn,
    "--agui-on-accent": accentOn,
    "--agui-card": cardBg,
    "--agui-card-border": cardBorder,
    "--agui-card-foreground": surfaceOn,
    "--agui-surface-elevated": elevatedSurface,
    "--agui-surface-border": subtleBorder,
    "--agui-muted-foreground": mutedForeground,
  } satisfies ThemeVars;
}

function normalizeHex(input: string | null | undefined): string {
  if (!input) return "#000000";
  const value = input.trim();
  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(value)) {
    if (value.length === 4) {
      // expand #rgb → #rrggbb
      return `#${[...value.slice(1)].map((c) => `${c}${c}`).join("")}`.toLowerCase();
    }
    return value.toLowerCase();
  }
  return "#000000";
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex).slice(1);
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixColors(baseHex: string, mixHex: string, weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHex);
  return rgbToHex({
    r: base.r * (1 - w) + mix.r * w,
    g: base.g * (1 - w) + mix.g * w,
    b: base.b * (1 - w) + mix.b * w,
  });
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.5;
}

function getReadableText(backgroundHex: string): string {
  return isDark(backgroundHex) ? "#f8fafc" : "#0f172a";
}
