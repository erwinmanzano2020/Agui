import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";
import type { GlobalItemRow } from "@/lib/db.types";

export type GlobalItemLookup = {
  found: boolean;
  item: GlobalItemRow;
};

function fallbackGlobalItem(barcode: string): GlobalItemRow {
  const trimmed = barcode.trim();
  const lastDigits = trimmed ? trimmed.slice(-6) : "";
  return {
    id: "fallback",
    barcode: trimmed || null,
    name: trimmed ? `Unknown ${lastDigits}` : "Unknown item",
    brand: null,
    size: null,
    default_uom: null,
    default_category: null,
    default_shortname: null,
    created_at: new Date().toISOString(),
  } satisfies GlobalItemRow;
}

export async function lookupGlobalItem(barcode: string, supabase?: SupabaseClient | null): Promise<GlobalItemLookup> {
  const normalized = barcode.trim();
  if (!normalized) {
    return { found: false, item: fallbackGlobalItem(barcode) };
  }

  const client = supabase ?? getSupabase();
  if (!client) {
    return { found: false, item: fallbackGlobalItem(barcode) };
  }

  const { data, error } = await client
    .from("global_items")
    .select("*")
    .eq("barcode", normalized)
    .maybeSingle();

  if (error) {
    console.warn("Failed to query global_items", error.message);
    return { found: false, item: fallbackGlobalItem(barcode) };
  }

  if (!data) {
    return { found: false, item: fallbackGlobalItem(barcode) };
  }

  return { found: true, item: data as GlobalItemRow };
}
