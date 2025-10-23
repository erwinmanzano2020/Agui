import { createContext, useContext, type ReactNode } from "react";

import { getSupabase } from "@/lib/supabase";

export const UI_TERM_KEYS = [
  "alliance",
  "guild",
  "company",
  "team",
  "alliance_pass",
  "guild_card",
  "house_pass",
] as const;

export type UiTermKey = (typeof UI_TERM_KEYS)[number];

export type UiTerms = Record<UiTermKey, string>;

export const DEFAULT_UI_TERMS: UiTerms = {
  alliance: "Alliance",
  guild: "Guild",
  company: "Company",
  team: "Team",
  alliance_pass: "Alliance Pass",
  guild_card: "Guild Card",
  house_pass: "Patron Pass",
};

function coerceTermValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mergeUiTerms(source: unknown, fallback: UiTerms = DEFAULT_UI_TERMS): UiTerms {
  const next: UiTerms = { ...fallback };
  if (!source || typeof source !== "object") {
    return next;
  }

  const record = source as Record<string, unknown>;
  for (const key of UI_TERM_KEYS) {
    const maybe = coerceTermValue(record[key]);
    if (maybe) {
      next[key] = maybe;
    }
  }
  return next;
}

export function applyUiTermUpdates(base: UiTerms, updates: Partial<Record<UiTermKey, unknown>>): UiTerms {
  const next: UiTerms = { ...base };
  for (const key of UI_TERM_KEYS) {
    const maybe = updates[key];
    if (typeof maybe === "undefined") continue;
    const coerced = coerceTermValue(maybe);
    next[key] = coerced ?? DEFAULT_UI_TERMS[key];
  }
  return next;
}

export async function loadUiTerms(): Promise<UiTerms> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return DEFAULT_UI_TERMS;
    }

    const { data, error } = await supabase
      .from("ui_terms")
      .select("terms")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      console.warn("Failed to load UI terms", error);
      return DEFAULT_UI_TERMS;
    }

    return mergeUiTerms(data?.terms);
  } catch (error) {
    console.warn("Failed to load UI terms", error);
    return DEFAULT_UI_TERMS;
  }
}

export const UiTermsContext = createContext<UiTerms>(DEFAULT_UI_TERMS);

export function UiTermsProvider({
  terms,
  children,
}: {
  terms: UiTerms;
  children: ReactNode;
}) {
  return <UiTermsContext.Provider value={terms}>{children}</UiTermsContext.Provider>;
}

export function useUiTerms(): UiTerms {
  return useContext(UiTermsContext);
}

export function getUiTerm(key: UiTermKey, terms?: UiTerms): string {
  const source = terms ?? DEFAULT_UI_TERMS;
  return source[key] ?? DEFAULT_UI_TERMS[key];
}
