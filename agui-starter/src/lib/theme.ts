export type ThemeConfig = {
  primary_hsl: string; // e.g. "221 83% 53%"
  accent_hsl: string;  // e.g. "160 84% 39%"
  radius_px: number;   // e.g. 14
};

// Defaults must mirror globals.css
export const DEFAULT_THEME: ThemeConfig = {
  primary_hsl: "206 49% 46%",
  accent_hsl: "198 93% 60%",
  radius_px: 14,
};

const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export type ThemeTokens = Partial<{
  accent: string;
  accentContrast: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  ring: string;
}>;

const TOKEN_TO_VARIABLE: Record<Exclude<keyof ThemeTokens, "accentContrast">, string> = {
  accent: "--accent",
  surface: "--surface",
  card: "--card",
  text: "--text",
  muted: "--muted",
  border: "--border",
  ring: "--ring",
};

const TOKEN_ALIASES: Record<string, string[]> = {
  accent: ["--agui-primary", "--agui-accent"],
  accentContrast: ["--agui-on-primary", "--agui-on-accent"],
  surface: ["--agui-surface"],
  card: ["--agui-card", "--agui-surface-elevated"],
  text: ["--agui-on-surface", "--agui-card-foreground"],
  muted: ["--agui-muted-foreground"],
  border: ["--agui-card-border", "--agui-surface-border"],
  ring: ["--agui-ring"],
};

type RGB = { r: number; g: number; b: number };

function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!HEX_REGEX.test(value)) return null;
  if (value.length === 4) {
    const expanded = value
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return `#${value.slice(1).toLowerCase()}`;
}

function normalizeColorValue(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return normalizeHex(trimmed) ?? trimmed;
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex) ?? "#000000";
  const numeric = parseInt(normalized.slice(1), 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(l1: number, l2: number): number {
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

export function getReadableText(hex: string): "#000000" | "#ffffff" {
  const normalized = normalizeHex(hex);
  if (!normalized) return "#000000";

  const luminance = relativeLuminance(normalized);
  const contrastWithWhite = contrastRatio(luminance, 1);
  const contrastWithBlack = contrastRatio(luminance, 0);

  const whitePasses = contrastWithWhite >= 4.5;
  const blackPasses = contrastWithBlack >= 4.5;

  if (whitePasses && !blackPasses) return "#ffffff";
  if (blackPasses && !whitePasses) return "#000000";
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#000000";
}

export type AccentContrastInfo = {
  recommendedText: "#000000" | "#ffffff";
  contrastRatio: number;
  passesAa: boolean;
};

export function getAccentContrastInfo(accent: string): AccentContrastInfo {
  const normalized = normalizeHex(accent);
  if (!normalized) {
    return { recommendedText: "#000000", contrastRatio: 21, passesAa: true };
  }

  const recommendedText = getReadableText(normalized);
  const accentLuminance = relativeLuminance(normalized);
  const textLuminance = recommendedText === "#ffffff" ? 1 : 0;
  const ratio = contrastRatio(accentLuminance, textLuminance);

  return {
    recommendedText,
    contrastRatio: Number.isFinite(ratio) ? ratio : 21,
    passesAa: ratio >= 4.5,
  };
}

export function applyTheme(tokens: ThemeTokens) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (!root) return;

  const updates: Array<[string, string]> = [];

  const accent = normalizeColorValue(tokens.accent);
  const explicitContrast = normalizeColorValue(tokens.accentContrast);

  if (accent) {
    updates.push(["--accent", accent]);

    const contrast = explicitContrast ?? getReadableText(accent);
    updates.push(["--accent-contrast", contrast]);
    TOKEN_ALIASES.accentContrast.forEach((alias) => updates.push([alias, contrast]));

    const ringColor = normalizeColorValue(tokens.ring) ?? accent;
    updates.push(["--ring", ringColor]);
    TOKEN_ALIASES.ring.forEach((alias) => updates.push([alias, ringColor]));

    TOKEN_ALIASES.accent.forEach((alias) => updates.push([alias, accent]));
  } else {
    if (explicitContrast) {
      updates.push(["--accent-contrast", explicitContrast]);
      TOKEN_ALIASES.accentContrast.forEach((alias) => updates.push([alias, explicitContrast]));
    }

    const ringOnly = normalizeColorValue(tokens.ring);
    if (ringOnly) {
      updates.push(["--ring", ringOnly]);
      TOKEN_ALIASES.ring.forEach((alias) => updates.push([alias, ringOnly]));
    }
  }

  (Object.keys(TOKEN_TO_VARIABLE) as Array<Exclude<keyof ThemeTokens, "accentContrast">>).forEach((key) => {
    if (key === "accent" || key === "ring") return;
    const value = normalizeColorValue(tokens[key]);
    if (!value) return;
    updates.push([TOKEN_TO_VARIABLE[key], value]);
    TOKEN_ALIASES[key]?.forEach((alias) => updates.push([alias, value]));
  });

  for (const [property, value] of updates) {
    root.style.setProperty(property, value);
  }
}
