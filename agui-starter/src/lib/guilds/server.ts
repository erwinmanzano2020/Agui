"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, GuildInsert } from "@/lib/db.types";
import { getServiceSupabase } from "@/lib/supabase-service";
import { slugify } from "@/lib/slug";

const GUILD_OWNER_ROLES = ["guild_master", "guild_member"] as const;
const DEFAULT_GUILD_TYPE = "MERCHANT";
const MAX_SLUG_ATTEMPTS = 25;

type DbClient = SupabaseClient<Database>;

type MaybeGuildRow = { id?: unknown; slug?: unknown } | null;

type GetOrCreateGuildOptions = {
  entityId: string;
  workspaceSlug: string;
  businessName: string;
};

function normalizeSlug(value: string): string {
  return slugify(value) || "guild";
}

function resolveClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabase<Database>();
}

async function fetchGuildBySlug(client: DbClient, slug: string): Promise<MaybeGuildRow> {
  const { data, error } = await client
    .from("guilds")
    .select("id,slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as MaybeGuildRow;
}

async function ensureGuildMembership(client: DbClient, guildId: string, entityId: string): Promise<void> {
  await Promise.all(
    GUILD_OWNER_ROLES.map(async (role) => {
      const { error } = await client
        .from("guild_roles")
        .upsert({ guild_id: guildId, entity_id: entityId, role }, { onConflict: "guild_id,entity_id,role" });

      if (error) {
        throw new Error(error.message);
      }
    }),
  );
}

async function createGuild(
  client: DbClient,
  slug: string,
  businessName: string,
): Promise<{ guildId: string; guildSlug: string }> {
  const desiredSlug = normalizeSlug(slug);
  const baseName = businessName || desiredSlug;

  let attempt = 0;
  let candidate = desiredSlug;

  while (attempt < MAX_SLUG_ATTEMPTS) {
    const existing = await fetchGuildBySlug(client, candidate).catch(() => null);
    if (!existing?.id) {
      const insert: GuildInsert = {
        slug: candidate,
        name: baseName,
        guild_type: DEFAULT_GUILD_TYPE,
      };

      const { data, error } = await client.from("guilds").insert(insert).select("id,slug").maybeSingle();
      if (error) {
        throw new Error(error.message);
      }

      const guildId = data && typeof data === "object" ? (data as { id?: unknown }).id : null;
      const guildSlug = data && typeof data === "object" ? (data as { slug?: unknown }).slug : null;

      if (typeof guildId === "string" && guildId) {
        return { guildId, guildSlug: typeof guildSlug === "string" && guildSlug ? guildSlug : candidate };
      }

      throw new Error("Failed to create guild for workspace");
    }

    attempt += 1;
    candidate = `${desiredSlug}-${attempt + 1}`;
  }

  throw new Error(`Unable to generate a unique guild slug for ${desiredSlug}`);
}

export async function getOrCreateGuildForWorkspace(
  { entityId, workspaceSlug, businessName }: GetOrCreateGuildOptions,
  client?: DbClient,
): Promise<{ guildId: string; guildSlug: string }> {
  const db = resolveClient(client);
  const slug = normalizeSlug(workspaceSlug || businessName);

  const existingGuild = await fetchGuildBySlug(db, slug).catch((error) => {
    console.error("prepareWorkspaceGuild: fetch existing guild failed", { error });
    return null;
  });
  const existingGuildId = existingGuild && typeof existingGuild === "object" ? (existingGuild as { id?: unknown }).id : null;
  const existingGuildSlug = existingGuild && typeof existingGuild === "object" ? (existingGuild as { slug?: unknown }).slug : null;

  if (typeof existingGuildId === "string" && existingGuildId) {
    await ensureGuildMembership(db, existingGuildId, entityId);
    return {
      guildId: existingGuildId,
      guildSlug: typeof existingGuildSlug === "string" && existingGuildSlug ? existingGuildSlug : slug,
    };
  }

  try {
    const { guildId, guildSlug } = await createGuild(db, slug, businessName || slug);
    await ensureGuildMembership(db, guildId, entityId);
    return { guildId, guildSlug };
  } catch (error) {
    console.error("prepareWorkspaceGuild: create path failed", { error, slug });
    throw error;
  }
}
