"use server";

import { getSupabase } from "@/lib/supabase";
import { getOrCreateEntityByIdentifier, type IdentifierKind } from "@/lib/auth/entity";
import { ensureGuildRecord } from "@/lib/taxonomy/guilds-server";

export async function loadGuild(slug: string) {
  const db = getSupabase();
  if (!db) return null;
  const ensuredGuild = await ensureGuildRecord(db, slug);
  if (!ensuredGuild) {
    return null;
  }

  const { data } = await db
    .from("guilds")
    .select("id,slug,name,guild_type")
    .eq("id", ensuredGuild.id)
    .maybeSingle();

  if (data) {
    return data;
  }

  return { ...ensuredGuild, guild_type: null };
}

export async function joinGuild(input: { slug: string; kind: IdentifierKind; value: string }) {
  const db = getSupabase();
  if (!db) throw new Error("DB unavailable");
  const guild = await loadGuild(input.slug);
  if (!guild) throw new Error("Guild not found");

  // resolve/create entity from email/phone
  const entity = await getOrCreateEntityByIdentifier(input.kind, input.value);

  // idempotent insert of role
  const { error } = await db
    .from("guild_roles")
    .upsert(
      { guild_id: guild.id, entity_id: entity.id, role: "guild_member" },
      { onConflict: "guild_id,entity_id,role" },
    );

  if (error) throw new Error(error.message);

  return { ok: true, guild: { id: guild.id, slug: guild.slug, name: guild.name }, entityId: entity.id };
}
