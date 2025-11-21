"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, GuildInsert } from "@/lib/db.types";
import { getServiceSupabase } from "@/lib/supabase-service";
import { slugify } from "@/lib/slug";

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
  const enriched = new Error(message) as Error & { cause?: SupabaseErrorLike };
  enriched.cause = error;
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
  const { data: membershipRow, error: membershipError } = await client
    .from("house_roles")
    .select("house_id")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    logSupabaseError("house_roles", membershipError, { entityId, source: "membership" });
    throwSupabaseError("house_roles", membershipError);
  }

  const houseId = membershipRow && typeof membershipRow === "object" ? (membershipRow as { house_id?: unknown }).house_id : null;
  if (!houseId || typeof houseId !== "string") {
    return null;
  }

  const { data: houseRow, error: houseError } = await client
    .from("houses")
    .select("guild_id")
    .eq("id", houseId)
    .maybeSingle();

  if (houseError) {
    logSupabaseError("houses", houseError, { houseId, source: "membership" });
    throwSupabaseError("houses", houseError);
  }

  const guildId = houseRow && typeof houseRow === "object" ? (houseRow as { guild_id?: unknown }).guild_id : null;
  if (!guildId || typeof guildId !== "string") {
    return null;
  }

  const { data: guildRow, error: guildError } = await client
    .from("guilds")
    .select("id,slug")
    .eq("id", guildId)
    .maybeSingle();

  if (guildError) {
    logSupabaseError("guilds", guildError, { guildId, source: "membership" });
    throwSupabaseError("guilds", guildError);
  }

  return guildRow as MaybeGuildRow;
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
    return {
      guildId: existingGuildId,
      guildSlug: typeof existingGuildSlug === "string" && existingGuildSlug ? existingGuildSlug : slug,
    };
  }

  if (typeof membershipGuildId === "string" && membershipGuildId) {
    return {
      guildId: membershipGuildId,
      guildSlug: typeof membershipGuildSlug === "string" && membershipGuildSlug ? membershipGuildSlug : slug,
    };
  }

  try {
    const { guildId, guildSlug } = await createGuild(db, slug, businessName || slug);
    return { guildId, guildSlug };
  } catch (error) {
    console.error("prepareWorkspaceGuild: create path failed", { error, slug, entityId, businessName });
    throw error;
  }
}
