import "server-only";

import { getServiceSupabase } from "@/lib/supabase-service";

function normalizeId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function normalizeRole(role: string): string {
  if (typeof role !== "string" || !role.trim()) {
    throw new Error("Role is required");
  }
  return role.trim();
}

export async function grantGuildRole(
  entityId: string,
  guildId: string,
  role: string,
  options?: { grantedBy?: string | null }
): Promise<void> {
  const svc = getServiceSupabase();
  const payload = {
    guild_id: normalizeId(guildId, "Guild ID"),
    entity_id: normalizeId(entityId, "Entity ID"),
    role: normalizeRole(role),
    granted_by: options?.grantedBy ?? null,
  };

  const { error } = await svc
    .from("guild_roles")
    .upsert(payload, { onConflict: "guild_id, entity_id, role", ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to grant guild role: ${error.message}`);
  }
}

export async function grantHouseRole(
  entityId: string,
  houseId: string,
  role: string,
  options?: { grantedBy?: string | null }
): Promise<void> {
  const svc = getServiceSupabase();
  const payload = {
    house_id: normalizeId(houseId, "House ID"),
    entity_id: normalizeId(entityId, "Entity ID"),
    role: normalizeRole(role),
    granted_by: options?.grantedBy ?? null,
  };

  const { error } = await svc
    .from("house_roles")
    .upsert(payload, { onConflict: "house_id, entity_id, role", ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to grant house role: ${error.message}`);
  }
}
