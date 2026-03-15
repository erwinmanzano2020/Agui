import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WorkspaceSummary = { id: string; name: string | null; slug: string | null; brand_name: string | null; logo_url: string | null };

export async function loadBusinessBySlug(slug: string): Promise<WorkspaceSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("houses")
    .select("id,name,slug,brand_name,logo_url")
    .eq("slug", slug)
    .maybeSingle<WorkspaceSummary>();

  if (error) {
    console.error("Failed to load business for settings", error);
    return null;
  }

  return data ?? null;
}
