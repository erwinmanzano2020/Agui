import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabase } from "../supabase";
import { parseEntity, type Entity, type EntityIdentifierType, type JsonValue } from "../types/taxonomy";

const UNIQUE_VIOLATION = "23505";

type JsonObject = Record<string, JsonValue>;

function normalizeIdentifierValue(type: EntityIdentifierType, value: string): string {
  const trimmed = value.trim();
  if (type === "EMAIL") return trimmed.toLowerCase();
  if (type === "PHONE") return trimmed.replace(/\s+/g, "");
  return trimmed;
}

function resolveSupabaseClient(explicit?: SupabaseClient): SupabaseClient {
  if (explicit) return explicit;
  const client = getSupabase();
  if (!client) {
    throw new Error("Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return client;
}

async function fetchEntityById(client: SupabaseClient, entityId: string): Promise<Entity | null> {
  const { data, error } = await client.from("entities").select("*").eq("id", entityId).maybeSingle();
  if (error) {
    throw new Error(`Failed to load entity ${entityId}: ${error.message}`);
  }
  if (!data) return null;
  return parseEntity(data);
}

function extractEntityId(user: User): string | null {
  const fromApp = typeof user.app_metadata?.entity_id === "string" ? (user.app_metadata.entity_id as string) : null;
  if (fromApp) return fromApp;

  const fromAppCamel = typeof user.app_metadata?.entityId === "string" ? (user.app_metadata.entityId as string) : null;
  if (fromAppCamel) return fromAppCamel;

  const fromUser = typeof user.user_metadata?.entity_id === "string" ? (user.user_metadata.entity_id as string) : null;
  if (fromUser) return fromUser;

  const fromUserCamel = typeof user.user_metadata?.entityId === "string" ? (user.user_metadata.entityId as string) : null;
  if (fromUserCamel) return fromUserCamel;

  return null;
}

function resolveDisplayName(user: User, fallbackIdentifier: string): string {
  const meta = user.user_metadata ?? {};
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    meta.displayName,
    user.email,
    user.phone,
    fallbackIdentifier,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallbackIdentifier;
}

function buildProfile(user: User): JsonObject {
  const profile: JsonObject = { auth_user_id: user.id };

  if (user.user_metadata && Object.keys(user.user_metadata).length > 0) {
    profile.user_metadata = user.user_metadata as JsonValue;
  }

  if (user.app_metadata && Object.keys(user.app_metadata).length > 0) {
    profile.app_metadata = user.app_metadata as JsonValue;
  }

  return profile;
}

export type GetOrCreateEntityArgs = {
  identifierType: EntityIdentifierType;
  identifierValue: string;
  supabase?: SupabaseClient;
  displayName?: string | null;
  profile?: JsonObject | null;
  makePrimary?: boolean;
};

async function lookupEntityByIdentifier(
  client: SupabaseClient,
  identifierType: EntityIdentifierType,
  normalizedValue: string,
): Promise<{ entity: Entity; identifierId: string; isPrimary: boolean } | null> {
  const { data, error } = await client
    .from("entity_identifiers")
    .select("id, is_primary, entity:entities(*)")
    .eq("identifier_type", identifierType)
    .eq("identifier_value", normalizedValue)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up entity identifier: ${error.message}`);
  }

  if (!data?.entity) {
    return null;
  }

  return {
    entity: parseEntity(data.entity),
    identifierId: data.id,
    isPrimary: data.is_primary ?? false,
  };
}

async function markIdentifierPrimary(client: SupabaseClient, identifierId: string): Promise<void> {
  const { error } = await client.from("entity_identifiers").update({ is_primary: true }).eq("id", identifierId);
  if (error) {
    throw new Error(`Failed to mark identifier as primary: ${error.message}`);
  }
}

export async function getOrCreateEntityByIdentifier({
  identifierType,
  identifierValue,
  supabase: explicitClient,
  displayName,
  profile,
  makePrimary = true,
}: GetOrCreateEntityArgs): Promise<Entity> {
  const client = resolveSupabaseClient(explicitClient);
  const normalizedValue = normalizeIdentifierValue(identifierType, identifierValue);

  const existing = await lookupEntityByIdentifier(client, identifierType, normalizedValue);
  if (existing) {
    if (makePrimary && !existing.isPrimary) {
      await markIdentifierPrimary(client, existing.identifierId);
    }
    return existing.entity;
  }

  const nextDisplayName = (displayName ?? normalizedValue).trim() || normalizedValue;
  const entityProfile = profile ?? {};

  const { data: insertedEntity, error: insertEntityError } = await client
    .from("entities")
    .insert({
      display_name: nextDisplayName,
      profile: entityProfile,
    })
    .select("*")
    .single();

  if (insertEntityError) {
    throw new Error(`Failed to create entity: ${insertEntityError.message}`);
  }

  const entity = parseEntity(insertedEntity);

  const { error: identifierInsertError } = await client
    .from("entity_identifiers")
    .insert({
      entity_id: entity.id,
      identifier_type: identifierType,
      identifier_value: normalizedValue,
      is_primary: makePrimary,
    });

  if (identifierInsertError) {
    if (identifierInsertError.code === UNIQUE_VIOLATION) {
      const conflict = await lookupEntityByIdentifier(client, identifierType, normalizedValue);
      if (conflict) {
        // Clean up the entity we just created since another request already claimed the identifier.
        await client.from("entities").delete().eq("id", entity.id);
        if (makePrimary && !conflict.isPrimary) {
          await markIdentifierPrimary(client, conflict.identifierId);
        }
        return conflict.entity;
      }
    }

    throw new Error(`Failed to link entity identifier: ${identifierInsertError.message}`);
  }

  return entity;
}

export type GetCurrentEntityOptions = {
  supabase?: SupabaseClient;
  identifierOrder?: EntityIdentifierType[];
};

export async function getCurrentEntity({
  supabase: explicitClient,
  identifierOrder = ["EMAIL", "PHONE"],
}: GetCurrentEntityOptions = {}): Promise<Entity | null> {
  const client = resolveSupabaseClient(explicitClient);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error(`Failed to resolve authenticated user: ${userError.message}`);
  }

  const user = userData?.user;
  if (!user) {
    return null;
  }

  const existingEntityId = extractEntityId(user);
  if (existingEntityId) {
    const entity = await fetchEntityById(client, existingEntityId);
    if (entity) {
      return entity;
    }
  }

  for (const identifierType of identifierOrder) {
    if (identifierType === "EMAIL" && user.email) {
      const displayName = resolveDisplayName(user, user.email);
      return getOrCreateEntityByIdentifier({
        identifierType: "EMAIL",
        identifierValue: user.email,
        supabase: client,
        displayName,
        profile: buildProfile(user),
        makePrimary: true,
      });
    }

    if (identifierType === "PHONE" && user.phone) {
      const displayName = resolveDisplayName(user, user.phone);
      return getOrCreateEntityByIdentifier({
        identifierType: "PHONE",
        identifierValue: user.phone,
        supabase: client,
        displayName,
        profile: buildProfile(user),
        makePrimary: true,
      });
    }
  }

  return null;
}
