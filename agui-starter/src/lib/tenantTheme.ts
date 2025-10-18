import { getSupabase } from "@/lib/supabase";
import { applyTheme } from "@/lib/theme";

export type TenantThemeBackground = "system" | "light" | "dark";
export type TenantThemeShape = "rounded" | "circle";

export type TenantTheme = {
  tenant_id: string;
  accent: string;
  background: TenantThemeBackground;
  shape: TenantThemeShape;
};

const DEFAULT_ACCENT = "#0ea5e9";
const DEFAULT_BACKGROUND: TenantThemeBackground = "system";
const DEFAULT_SHAPE: TenantThemeShape = "rounded";
const STORAGE_PREFIX = "agui:tenant-theme:";

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const TENANT_THEME_DEFAULTS: Pick<TenantTheme, "accent" | "background" | "shape"> = {
  accent: DEFAULT_ACCENT,
  background: DEFAULT_BACKGROUND,
  shape: DEFAULT_SHAPE,
};

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

function buildDefaultTheme(tenantId: string): TenantTheme {
  return {
    tenant_id: tenantId,
    accent: DEFAULT_ACCENT,
    background: DEFAULT_BACKGROUND,
    shape: DEFAULT_SHAPE,
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
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fallback;
  }

  try {
    const { data, error } = await supabase
      .from("tenant_theme")
      .select("tenant_id, accent, background, shape")
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
  });

  if (error) {
    throw error;
  }

  writeCachedTheme(normalized);
}

export function applyTenantTheme(theme: Pick<TenantTheme, "accent" | "background" | "shape">): void {
  if (typeof document === "undefined") return;

  const accent = normalizeAccent(theme.accent);
  applyTheme({ accent });

  const background = normalizeBackground(theme.background);
  const root = document.documentElement;

  if (background === "system") {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = prefersDark ? "dark" : "light";
  } else {
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
  });

  return fallback;
}
