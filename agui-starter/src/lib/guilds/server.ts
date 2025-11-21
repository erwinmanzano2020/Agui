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

type SupabaseErrorLike = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function supabaseErrorMessage(table: string, error: SupabaseErrorLike): string {
  const parts = [error?.message?.trim()].filter(Boolean) as string[];
  if (error?.details) parts.push(`details: ${error.details}`);
  if (error?.hint) parts.push(`hint: ${error.hint}`);
  if (error?.code) parts.push(`code: ${error.code}`);
  const suffix = parts.length > 0 ? parts.join(" | ") : "unknown error";
  return `[${table}] ${suffix}`;
}

function logSupabaseError(table: string, error: SupabaseErrorLike, context?: Record<string, unknown>) {
  console.error("prepareWorkspaceGuild: supabase error", {
    table,
    message: error?.message,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    code: error?.code ?? null,
    context: context ?? {},
  });
}

function throwSupabaseError(table: string, error: SupabaseErrorLike): never {
  const message = supabaseErrorMessage(table, error);
  const enriched = new Error(message);
  (enriched as any).cause = error;
  throw enriched;
}

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
    logSupabaseError("guilds", error, { slug });
    throwSupabaseError("guilds", error);
  }

  return data as MaybeGuildRow;
}

async function fetchGuildByEntity(client: DbClient, entityId: string): Promise<MaybeGuildRow> {
  const { data, error } = await client
    .from("guild_roles")
    .select("guild_id,guilds!inner(id,slug)")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError("guild_roles", error, { entityId, source: "membership" });
    throwSupabaseError("guild_roles", error);
  }

  const guild = data && typeof data === "object" ? (data as { guilds?: MaybeGuildRow }).guilds : null;
  if (guild && typeof guild === "object") {
    return guild as MaybeGuildRow;
  }

  const guildId = data && typeof data === "object" ? (data as { guild_id?: unknown }).guild_id : null;
  if (typeof guildId === "string" && guildId) {
    return { id: guildId };
  }

  return null;
}

async function ensureGuildMembership(client: DbClient, guildId: string, entityId: string): Promise<void> {
  await Promise.all(
    GUILD_OWNER_ROLES.map(async (role) => {
      const { error } = await client
        .from("guild_roles")
        .upsert({ guild_id: guildId, entity_id: entityId, role }, { onConflict: "guild_id,entity_id,role" });

      if (error) {
        logSupabaseError("guild_roles", error, { guildId, entityId, role });
        throwSupabaseError("guild_roles", error);
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
        logSupabaseError("guilds", error, insert);
        throwSupabaseError("guilds", error);
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

  console.info("prepareWorkspaceGuild:start", { entityId, slug, businessName });

  const existingGuild = await fetchGuildBySlug(db, slug).catch((error) => {
    console.error("prepareWorkspaceGuild: fetch existing guild failed", { error, slug });
    return null;
  });
  const existingGuildId = existingGuild && typeof existingGuild === "object" ? (existingGuild as { id?: unknown }).id : null;
  const existingGuildSlug = existingGuild && typeof existingGuild === "object" ? (existingGuild as { slug?: unknown }).slug : null;

  const membershipGuild = !existingGuildId
    ? await fetchGuildByEntity(db, entityId).catch((error) => {
        console.error("prepareWorkspaceGuild: fetch guild by entity failed", { error, entityId });
        return null;
      })
    : null;
  const membershipGuildId = membershipGuild && typeof membershipGuild === "object" ? (membershipGuild as { id?: unknown }).id : null;
  const membershipGuildSlug =
    membershipGuild && typeof membershipGuild === "object" ? (membershipGuild as { slug?: unknown }).slug : null;

  if (typeof existingGuildId === "string" && existingGuildId) {
    await ensureGuildMembership(db, existingGuildId, entityId);
    return {
      guildId: existingGuildId,
      guildSlug: typeof existingGuildSlug === "string" && existingGuildSlug ? existingGuildSlug : slug,
    };
  }

  if (typeof membershipGuildId === "string" && membershipGuildId) {
    await ensureGuildMembership(db, membershipGuildId, entityId);
    return {
      guildId: membershipGuildId,
      guildSlug: typeof membershipGuildSlug === "string" && membershipGuildSlug ? membershipGuildSlug : slug,
    };
  }

  try {
    const { guildId, guildSlug } = await createGuild(db, slug, businessName || slug);
    await ensureGuildMembership(db, guildId, entityId);
    return { guildId, guildSlug };
  } catch (error) {
    console.error("prepareWorkspaceGuild: create path failed", { error, slug, entityId, businessName });
    throw error;
  }
}
