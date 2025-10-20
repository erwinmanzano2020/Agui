import { getSupabase } from "@/lib/supabase";
import { applyTheme, type ThemeTokens } from "@/lib/theme";

export type TenantThemeBackground = "system" | "light" | "dark";
export type TenantThemeShape = "rounded" | "circle";

export type TenantThemePresetDefinition = {
  id: string;
  label: string;
  description: string;
  background: TenantThemeBackground;
  accent: string;
  tokens: ThemeTokens;
  preview: {
    background: string;
    iconBackground: string;
    iconColor: string;
    labelColor: string;
    borderColor: string;
  };
};

export const TENANT_THEME_PRESETS = {
  black: {
    id: "black",
    label: "Black",
    description: "Deep blacks with soft gray highlights.",
    background: "dark",
    accent: "#38bdf8",
    tokens: {
      surface: "#050506",
      card: "#111114",
      text: "#f4f4f5",
      muted: "#a1a1aa",
      border: "rgba(255,255,255,0.1)",
      ring: "rgba(148,163,184,0.4)",
    },
    preview: {
      background: "linear-gradient(145deg, #111114 0%, #050506 100%)",
      iconBackground: "rgba(255,255,255,0.1)",
      iconColor: "#f8fafc",
      labelColor: "#f4f4f5",
      borderColor: "rgba(255,255,255,0.08)",
    },
  },
  charcoal: {
    id: "charcoal",
    label: "Charcoal",
    description: "Satin charcoal with crisp highlights.",
    background: "dark",
    accent: "#38bdf8",
    tokens: {
      surface: "#1f2125",
      card: "#2b2d31",
      text: "#f7f8fb",
      muted: "#cbd5f5",
      border: "rgba(255,255,255,0.08)",
      ring: "rgba(226,232,240,0.45)",
    },
    preview: {
      background: "linear-gradient(150deg, #2b2d31 0%, #1f2125 100%)",
      iconBackground: "rgba(255,255,255,0.12)",
      iconColor: "#ffffff",
      labelColor: "#f7f8fb",
      borderColor: "rgba(255,255,255,0.08)",
    },
  },
  pearl: {
    id: "pearl",
    label: "Pearl",
    description: "Warm neutrals with soft contrast.",
    background: "light",
    accent: "#2563eb",
    tokens: {
      surface: "#f5f5f7",
      card: "#ffffff",
      text: "#27272a",
      muted: "#4b5563",
      border: "rgba(17,24,39,0.1)",
      ring: "rgba(59,130,246,0.28)",
    },
    preview: {
      background: "linear-gradient(150deg, #f8f7f4 0%, #ebe9e1 100%)",
      iconBackground: "rgba(17,24,39,0.08)",
      iconColor: "#27272a",
      labelColor: "#27272a",
      borderColor: "rgba(17,24,39,0.08)",
    },
  },
  white: {
    id: "white",
    label: "White",
    description: "Bright whites with airy depth.",
    background: "light",
    accent: "#2563eb",
    tokens: {
      surface: "#ffffff",
      card: "#f8fafc",
      text: "#111827",
      muted: "#4b5563",
      border: "rgba(15,23,42,0.08)",
      ring: "rgba(30,64,175,0.25)",
    },
    preview: {
      background: "linear-gradient(140deg, #ffffff 0%, #f4f6fb 100%)",
      iconBackground: "rgba(17,24,39,0.08)",
      iconColor: "#111827",
      labelColor: "#111827",
      borderColor: "rgba(15,23,42,0.06)",
    },
  },
  emerald: {
    id: "emerald",
    label: "Emerald",
    description: "Fresh green with pearl neutrals.",
    background: "light",
    accent: "#10b981",
    tokens: {
      surface: "#f4fbf7",
      card: "#ffffff",
      text: "#0f172a",
      muted: "#0f766e",
      border: "rgba(15,118,110,0.14)",
      ring: "rgba(16,185,129,0.28)",
    },
    preview: {
      background: "linear-gradient(145deg, #d3f6e6 0%, #9ae6c8 100%)",
      iconBackground: "rgba(15,118,110,0.16)",
      iconColor: "#065f46",
      labelColor: "#0f172a",
      borderColor: "rgba(16,185,129,0.2)",
    },
  },
  royal: {
    id: "royal",
    label: "Royal",
    description: "Midnight navy with regal glow.",
    background: "dark",
    accent: "#6366f1",
    tokens: {
      surface: "#121829",
      card: "#1b2340",
      text: "#f1f5f9",
      muted: "#c7d2fe",
      border: "rgba(148,163,184,0.18)",
      ring: "rgba(99,102,241,0.35)",
    },
    preview: {
      background: "linear-gradient(150deg, #1b2340 0%, #131b2f 100%)",
      iconBackground: "rgba(99,102,241,0.18)",
      iconColor: "#e0e7ff",
      labelColor: "#f1f5f9",
      borderColor: "rgba(99,102,241,0.25)",
    },
  },
  "pearl-blue": {
    id: "pearl-blue",
    label: "Pearl Blue",
    description: "Powder blue with cool accents.",
    background: "light",
    accent: "#2563eb",
    tokens: {
      surface: "#f0f5ff",
      card: "#ffffff",
      text: "#111827",
      muted: "#475569",
      border: "rgba(37,99,235,0.18)",
      ring: "rgba(59,130,246,0.28)",
    },
    preview: {
      background: "linear-gradient(150deg, #f4f7ff 0%, #dbe6ff 100%)",
      iconBackground: "rgba(37,99,235,0.16)",
      iconColor: "#1d4ed8",
      labelColor: "#111827",
      borderColor: "rgba(30,64,175,0.18)",
    },
  },
} satisfies Record<string, TenantThemePresetDefinition>;

export type TenantThemePreset = keyof typeof TENANT_THEME_PRESETS;
export const TENANT_THEME_PRESET_LIST = Object.values(TENANT_THEME_PRESETS);

export type TenantTheme = {
  tenant_id: string;
  accent: string;
  background: TenantThemeBackground;
  shape: TenantThemeShape;
  preset: TenantThemePreset;
};

type TenantUserLike = {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
} | null | undefined;

const DEFAULT_PRESET: TenantThemePreset = "pearl";
const DEFAULT_ACCENT = TENANT_THEME_PRESETS[DEFAULT_PRESET].accent;
const DEFAULT_BACKGROUND: TenantThemeBackground =
  TENANT_THEME_PRESETS[DEFAULT_PRESET].background;
const DEFAULT_SHAPE: TenantThemeShape = "rounded";
const STORAGE_PREFIX = "agui:tenant-theme:";

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const TENANT_THEME_DEFAULTS: Pick<TenantTheme, "accent" | "background" | "shape" | "preset"> = {
  accent: DEFAULT_ACCENT,
  background: DEFAULT_BACKGROUND,
  shape: DEFAULT_SHAPE,
  preset: DEFAULT_PRESET,
};

let systemMediaQuery: MediaQueryList | null = null;
let systemMediaListener: ((event: MediaQueryListEvent) => void) | null = null;

function normalizeHexColor(value: string): string | null {
  let next = value.trim();
  if (!next) return null;
  if (!next.startsWith("#")) {
    next = `#${next}`;
  }
  if (!HEX_PATTERN.test(next)) {
    return null;
  }
  if (next.length === 4) {
    const [, r, g, b] = next;
    next = `#${r}${r}${g}${g}${b}${b}`;
  }
  return `#${next.slice(1).toLowerCase()}`;
}

function normalizeAccent(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_ACCENT;
  }
  const normalized = normalizeHexColor(value);
  return normalized ?? DEFAULT_ACCENT;
}

function normalizeBackground(value: unknown): TenantThemeBackground {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return DEFAULT_BACKGROUND;
}

function normalizeShape(value: unknown): TenantThemeShape {
  if (value === "circle" || value === "rounded") {
    return value;
  }
  return DEFAULT_SHAPE;
}

function normalizePreset(value: unknown): TenantThemePreset {
  if (typeof value === "string" && value in TENANT_THEME_PRESETS) {
    return value as TenantThemePreset;
  }
  return DEFAULT_PRESET;
}

function getPreset(preset: TenantThemePreset) {
  return TENANT_THEME_PRESETS[preset] ?? TENANT_THEME_PRESETS[DEFAULT_PRESET];
}

function buildDefaultTheme(tenantId: string): TenantTheme {
  return {
    tenant_id: tenantId,
    accent: DEFAULT_ACCENT,
    background: DEFAULT_BACKGROUND,
    shape: DEFAULT_SHAPE,
    preset: DEFAULT_PRESET,
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("Unable to access localStorage for tenant theme", error);
    return null;
  }
}

function storageKey(tenantId: string): string {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function readCachedTheme(tenantId: string): TenantTheme | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TenantTheme> & { tenant_id?: string };
    if (!parsed || typeof parsed !== "object") return null;
    return {
      tenant_id: tenantId,
      accent: normalizeAccent(parsed.accent),
      background: normalizeBackground(parsed.background),
      shape: normalizeShape(parsed.shape),
      preset: normalizePreset(parsed.preset),
    };
  } catch (error) {
    console.warn("Failed to read cached tenant theme", error);
    return null;
  }
}

function writeCachedTheme(theme: TenantTheme): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(theme.tenant_id), JSON.stringify(theme));
  } catch (error) {
    console.warn("Failed to cache tenant theme", error);
  }
}

function applyPreferredTheme(root: HTMLElement, prefersDark: boolean) {
  root.dataset.theme = prefersDark ? "dark" : "light";
}

function cleanupSystemThemeListener() {
  if (!systemMediaQuery || !systemMediaListener) {
    systemMediaQuery = null;
    systemMediaListener = null;
    return;
  }

  if (typeof systemMediaQuery.removeEventListener === "function") {
    systemMediaQuery.removeEventListener("change", systemMediaListener);
  } else if (typeof systemMediaQuery.removeListener === "function") {
    // Support older Safari versions
    systemMediaQuery.removeListener(systemMediaListener);
  }

  systemMediaQuery = null;
  systemMediaListener = null;
}

function ensureSystemThemeListener(root: HTMLElement) {
  if (systemMediaQuery && systemMediaListener) {
    applyPreferredTheme(root, systemMediaQuery.matches);
    return;
  }

  const query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (!query) {
    root.dataset.theme = "light";
    return;
  }

  const listener: (event: MediaQueryListEvent) => void = (event) => {
    applyPreferredTheme(root, event.matches);
  };

  applyPreferredTheme(root, query.matches);

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener);
  } else if (typeof query.addListener === "function") {
    // Support older Safari versions
    query.addListener(listener);
  }

  systemMediaQuery = query;
  systemMediaListener = listener;
}

export function resolveTenantId(user: TenantUserLike): string | null {
  if (!user) return null;
  const fromApp = typeof user.app_metadata?.tenant_id === "string" ? (user.app_metadata.tenant_id as string) : null;
  if (fromApp) return fromApp;
  const fromMeta = typeof user.user_metadata?.tenant_id === "string" ? (user.user_metadata.tenant_id as string) : null;
  return fromMeta;
}

function mergeTheme(
  tenantId: string,
  theme: Partial<Record<keyof TenantTheme, unknown>> | null | undefined
): TenantTheme {
  const base = buildDefaultTheme(tenantId);
  if (!theme) return base;
  return {
    tenant_id: tenantId,
    accent: normalizeAccent(theme.accent),
    background: normalizeBackground(theme.background),
    shape: normalizeShape(theme.shape),
    preset: normalizePreset(theme.preset),
  };
}

export type GetTenantThemeOptions = {
  /** Apply the cached + fetched theme to the DOM as values resolve. */
  apply?: boolean;
};

export async function getTenantTheme(
  tenantId: string,
  { apply = false }: GetTenantThemeOptions = {}
): Promise<TenantTheme> {
  const cached = readCachedTheme(tenantId);
  const fallback = cached ?? buildDefaultTheme(tenantId);

  if (apply) {
    applyTenantTheme({
      accent: fallback.accent,
      background: fallback.background,
      shape: fallback.shape,
      preset: fallback.preset,
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fallback;
  }

  try {
    const { data, error } = await supabase
      .from("tenant_theme")
      .select("tenant_id, accent, background, shape, preset")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      writeCachedTheme(fallback);
      return fallback;
    }

    const normalized = mergeTheme(tenantId, data);
    writeCachedTheme(normalized);

    if (apply) {
      applyTenantTheme({
        accent: normalized.accent,
        background: normalized.background,
        shape: normalized.shape,
        preset: normalized.preset,
      });
    }

    return normalized;
  } catch (error) {
    console.warn("Failed to fetch tenant theme", error);
    return fallback;
  }
}

export async function saveTenantTheme(theme: TenantTheme): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const normalized = mergeTheme(theme.tenant_id, theme);

  const { error } = await supabase.from("tenant_theme").upsert({
    tenant_id: normalized.tenant_id,
    accent: normalized.accent,
    background: normalized.background,
    shape: normalized.shape,
    preset: normalized.preset,
  });

  if (error) {
    throw error;
  }

  writeCachedTheme(normalized);
}

export function applyTenantTheme(theme: Pick<TenantTheme, "accent" | "background" | "shape" | "preset">): void {
  if (typeof document === "undefined") return;

  const accent = normalizeAccent(theme.accent);
  const preset = getPreset(normalizePreset(theme.preset));

  applyTheme({
    accent,
    surface: preset.tokens.surface,
    card: preset.tokens.card,
    text: preset.tokens.text,
    muted: preset.tokens.muted,
    border: preset.tokens.border,
    ring: preset.tokens.ring ?? accent,
  });

  const root = document.documentElement;

  const ringColor = preset.tokens.ring ?? accent;
  const ringOffsetColor = preset.tokens.card ?? preset.tokens.surface ?? "transparent";

  const previewUpdates: Array<[string, string | null]> = [
    ["--launcher-tile-background", preset.preview.background],
    ["--launcher-tile-border", preset.preview.borderColor],
    ["--launcher-tile-foreground", preset.preview.labelColor],
    ["--launcher-icon-background", preset.preview.iconBackground],
    ["--launcher-icon-color", preset.preview.iconColor],
    ["--launcher-icon-border", preset.preview.borderColor],
    ["--launcher-tooltip-background", preset.preview.iconBackground],
    ["--launcher-tooltip-border", preset.preview.borderColor],
    ["--launcher-tooltip-color", preset.preview.labelColor],
    ["--launcher-tile-ring", ringColor],
    ["--launcher-tile-ring-offset", ringOffsetColor],
  ];

  for (const [property, value] of previewUpdates) {
    if (value) {
      root.style.setProperty(property, value);
    } else {
      root.style.removeProperty(property);
    }
  }

  const background = normalizeBackground(theme.background);

  root.dataset.background = background;
  root.dataset.themePreset = preset.id;

  if (background === "system") {
    ensureSystemThemeListener(root);
  } else {
    cleanupSystemThemeListener();
    root.dataset.theme = background;
  }

  root.dataset.shape = normalizeShape(theme.shape);
}

export function bootstrapTenantTheme(tenantId: string): TenantTheme {
  const cached = readCachedTheme(tenantId);
  const fallback = cached ?? buildDefaultTheme(tenantId);

  applyTenantTheme({
    accent: fallback.accent,
    background: fallback.background,
    shape: fallback.shape,
    preset: fallback.preset,
  });

  return fallback;
}
