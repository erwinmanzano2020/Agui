"use server";

import { getSupabase } from "@/lib/supabase";
import { uniqueSlug } from "@/lib/slug";
import { getOrCreateEntityByIdentifier, getCurrentEntity } from "@/lib/auth/entity";

/** Load guild row by slug */
export async function loadGuild(slug: string) {
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db.from("guilds").select("id,slug,name,guild_type").eq("slug", slug).maybeSingle();
  return data ?? null;
}

/** Check if an entity is a member of the guild (any of common roles) */
export async function isGuildMember(entityId: string, guildId: string) {
  const db = getSupabase();
  if (!db) return false;
  const roles = [
    "guild_member",
    "guild_master",
    "guild_elder",
    "staff",
    "franchisee",
    "org_admin",
    "agui_user",
  ];
  const { data, error } = await db
    .from("guild_roles")
    .select("role", { head: false })
    .eq("guild_id", guildId)
    .eq("entity_id", entityId)
    .in("role", roles);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export type CreateHouseInput = {
  name: string;
  type: "RETAIL" | "MANUFACTURER" | "BRAND" | "SERVICE" | "WHOLESALE" | "DISTRIBUTOR";
  address?: string;
  tax_flags?: string; // JSON string
  seed_parties?: boolean;
  owner_identifier_kind?: "email" | "phone"; // fallback if no current entity
  owner_identifier_value?: string;
};

/** Create House under guild; assign house_owner; optionally seed parties */
export async function createHouse(slug: string, input: CreateHouseInput) {
  const db = getSupabase();
  if (!db) throw new Error("DB unavailable");

  const guild = await loadGuild(slug);
  if (!guild) throw new Error("Guild not found");

  // Resolve creator entity from current session (required for permission check)
  const actor = await getCurrentEntity();
  if (!actor) throw new Error("No actor entity");

  // Guard: must be a guild member
  const ok = await isGuildMember(actor.id, guild.id);
  if (!ok) throw new Error("Only guild members can create a company");

  // Determine the house owner (default to actor, allow explicit identifier override)
  let ownerEntity = actor;
  if (input.owner_identifier_kind && input.owner_identifier_value) {
    ownerEntity = await getOrCreateEntityByIdentifier(
      input.owner_identifier_kind,
      input.owner_identifier_value,
    );
  }

  // Unique slug
  const slugCandidate = await uniqueSlug(input.name, "houses");

  // Parse JSON-ish, but keep server-safe
  const address_json = input.address ? { line1: input.address } : null;
  let tax_flags: any = null;
  if (input.tax_flags) {
    try {
      tax_flags = JSON.parse(input.tax_flags);
    } catch {
      tax_flags = { raw: input.tax_flags };
    }
  }

  // Insert house
  const { data: house, error: e1 } = await db
    .from("houses")
    .insert({
      guild_id: guild.id,
      slug: slugCandidate,
      name: input.name,
      house_type: input.type,
      address_json,
      tax_flags,
    })
    .select("id,slug,name")
    .single();
  if (e1) throw new Error(e1.message);

  // Assign owner role (idempotent upsert)
  const { error: e2 } = await db
    .from("house_roles")
    .upsert(
      { house_id: house.id, entity_id: ownerEntity.id, role: "house_owner" },
      { onConflict: "house_id,entity_id,role" },
    );
  if (e2) throw new Error(e2.message);

  // Optional seed parties
  if (input.seed_parties) {
    await db.from("parties").insert([
      { scope: "HOUSE", house_id: house.id, slug: "operations", name: "Operations" },
      { scope: "HOUSE", house_id: house.id, slug: "sales", name: "Sales" },
    ]);
  }

  return { ok: true, slug: house.slug, name: house.name };
}
