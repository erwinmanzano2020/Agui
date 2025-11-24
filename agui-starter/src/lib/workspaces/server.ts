import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WorkspaceSummary = { id: string; name: string | null; slug: string | null };

export async function loadBusinessBySlug(slug: string): Promise<WorkspaceSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("houses")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle<WorkspaceSummary>();

  if (error) {
    console.error("Failed to load business for settings", error);
    return null;
  }

  return data ?? null;
}
