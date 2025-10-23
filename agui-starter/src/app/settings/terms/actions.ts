"use server";

import { getSupabase } from "@/lib/supabase";
import {
  applyUiTermUpdates,
  loadUiTerms,
  type UiTermKey,
  type UiTerms,
} from "@/lib/ui-terms";

const ROW_ID = "default";

export type UiTermsUpdate = Partial<Record<UiTermKey, string>>;

export type UpdateUiTermsResult = {
  terms: UiTerms;
  persisted: boolean;
};

export async function updateUiTerms(updates: UiTermsUpdate): Promise<UpdateUiTermsResult> {
  const base = await loadUiTerms();
  const next = applyUiTermUpdates(base, updates);
  const supabase = getSupabase();

  if (!supabase) {
    return { terms: next, persisted: false };
  }

  const { error } = await supabase
    .from("ui_terms")
    .upsert(
      {
        id: ROW_ID,
        terms: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(error.message);
  }

  return { terms: next, persisted: true };
}
