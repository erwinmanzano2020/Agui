import { stringEnum } from "@/lib/schema-helpers";

const ENTITY_IDENTIFIER_VALUES = ["EMAIL", "PHONE"] as const;
export const EntityIdentifierType = stringEnum(ENTITY_IDENTIFIER_VALUES);
export type EntityIdentifierType = (typeof ENTITY_IDENTIFIER_VALUES)[number];
export const entityIdentifierTypeValues = ENTITY_IDENTIFIER_VALUES;

const GUILD_TYPE_VALUES = ["MERCHANT", "ADVENTURER", "APOTHECARY"] as const;
export const GuildType = stringEnum(GUILD_TYPE_VALUES);
export type GuildType = (typeof GUILD_TYPE_VALUES)[number];
export const guildTypeValues = GUILD_TYPE_VALUES;

const HOUSE_TYPE_VALUES = [
  "RETAIL",
  "MANUFACTURER",
  "BRAND",
  "SERVICE",
  "WHOLESALE",
  "DISTRIBUTOR",
] as const;
export const HouseType = stringEnum(HOUSE_TYPE_VALUES);
export type HouseType = (typeof HOUSE_TYPE_VALUES)[number];
export const houseTypeValues = HOUSE_TYPE_VALUES;

const PARTY_SCOPE_VALUES = ["GUILD", "HOUSE"] as const;
export const PartyScope = stringEnum(PARTY_SCOPE_VALUES);
export type PartyScope = (typeof PARTY_SCOPE_VALUES)[number];

const ALLIANCE_ROLE_VALUES = [
  "alliance_lord",
  "alliance_steward",
  "alliance_member",
] as const;
export const AllianceRole = stringEnum(ALLIANCE_ROLE_VALUES);
export type AllianceRole = (typeof ALLIANCE_ROLE_VALUES)[number];

const GUILD_ROLE_VALUES = [
  "guild_master",
  "guild_elder",
  "staff",
  "supplier",
  "customer",
  "franchisee",
  "org_admin",
  "agui_user",
  "guild_member",
] as const;
export const GuildRole = stringEnum(GUILD_ROLE_VALUES);
export type GuildRole = (typeof GUILD_ROLE_VALUES)[number];

const HOUSE_ROLE_VALUES = ["house_owner", "house_manager", "house_staff"] as const;
export const HouseRole = stringEnum(HOUSE_ROLE_VALUES);
export type HouseRole = (typeof HOUSE_ROLE_VALUES)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export type Entity = {
  id: string;
  display_name: string;
  profile: JsonObject;
  created_at: string;
  updated_at: string;
};

export function parseEntity(input: unknown): Entity {
  if (!isRecord(input)) {
    throw new Error("Entity payload must be an object");
  }

  const { id, display_name, profile, created_at, updated_at } = input;

  if (typeof id !== "string") {
    throw new Error("Entity payload is missing an id");
  }

  if (typeof display_name !== "string") {
    throw new Error("Entity payload is missing a display_name");
  }

  if (typeof created_at !== "string" || typeof updated_at !== "string") {
    throw new Error("Entity payload is missing timestamps");
  }

  if (!isJsonObject(profile)) {
    throw new Error("Entity payload has an invalid profile");
  }

  return {
    id,
    display_name,
    profile,
    created_at,
    updated_at,
  };
}
