import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureInventoryAccessOptions = {
  supabase: SupabaseClient;
  houseId: string;
  entityId: string;
  guildId?: string | null;
};

export async function ensureInventoryAccess({
  supabase,
  houseId,
  guildId,
  entityId,
}: EnsureInventoryAccessOptions): Promise<boolean> {
  const [houseRoleResult, guildRoleResult] = await Promise.all([
    supabase
      .from("house_roles")
      .select("id")
      .eq("house_id", houseId)
      .eq("entity_id", entityId)
      .maybeSingle(),
    guildId
      ? supabase
          .from("guild_roles")
          .select("id")
          .eq("guild_id", guildId)
          .eq("entity_id", entityId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (houseRoleResult.error) {
    throw new Error(`Failed to verify house role: ${houseRoleResult.error.message}`);
  }

  if (guildRoleResult.error) {
    throw new Error(`Failed to verify guild role: ${guildRoleResult.error.message}`);
  }

  const hasHouseRole = Boolean(houseRoleResult.data);
  const hasGuildRole = Boolean(guildRoleResult.data);
  return hasHouseRole || hasGuildRole;
}

