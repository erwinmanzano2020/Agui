import type { SupabaseClient } from "@supabase/supabase-js";

export type HouseRecord = {
  id: string;
  name: string;
  slug: string | null;
  guild_id: string;
  guild: {
    id: string;
    name: string;
    slug: string | null;
  } | null;
};

export async function loadHouseBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<HouseRecord | null> {
  const { data, error } = await supabase
    .from("houses")
    .select("id,name,slug,guild_id,guild:guilds(id,name,slug)")
    .eq("slug", slug)
    .maybeSingle<HouseRecord>();

  if (error) {
    throw new Error(`Failed to resolve house by slug ${slug}: ${error.message}`);
  }

  return data ?? null;
}
