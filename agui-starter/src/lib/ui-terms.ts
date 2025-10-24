import { getSupabase } from "@/lib/supabase";

export type UiTerms = {
  alliance: string;
  guild: string;
  company: string;
  team: string;
  alliance_pass: string;
  guild_card: string;
  house_pass: string;
};

export const DEFAULT_TERMS: UiTerms = {
  alliance: "Alliance",
  guild: "Guild",
  company: "Company",
  team: "Team",
  alliance_pass: "Alliance Pass",
  guild_card: "Guild Card",
  house_pass: "Patron Pass",
};

export const DEFAULT_UI_TERMS = DEFAULT_TERMS;

const ROW_ID = "default";

export async function loadUiTerms(): Promise<UiTerms> {
  try {
    const db = getSupabase();
    if (!db) return DEFAULT_TERMS;
    const { data, error } = await db
      .from("ui_terms")
      .select("terms")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load UI terms", error);
      return DEFAULT_TERMS;
    }
    const terms = data?.terms ?? {};
    return { ...DEFAULT_TERMS, ...terms };
  } catch (error) {
    console.warn("Failed to load UI terms", error);
    return DEFAULT_TERMS;
  }
}

export async function saveUiTerms(next: Partial<UiTerms>) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from("ui_terms")
    .upsert({ id: ROW_ID, terms: next, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
