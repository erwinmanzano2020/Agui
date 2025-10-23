import { z } from "zod";

export const EntityIdentifierType = z.enum(["EMAIL", "PHONE"]);
export type EntityIdentifierType = z.infer<typeof EntityIdentifierType>;
export const entityIdentifierTypeValues = EntityIdentifierType.options;

export const GuildType = z.enum(["MERCHANT", "ADVENTURER", "APOTHECARY"]);
export type GuildType = z.infer<typeof GuildType>;
export const guildTypeValues = GuildType.options;

export const HouseType = z.enum([
  "RETAIL",
  "MANUFACTURER",
  "BRAND",
  "SERVICE",
  "WHOLESALE",
  "DISTRIBUTOR",
]);
export type HouseType = z.infer<typeof HouseType>;
export const houseTypeValues = HouseType.options;

export const PartyScope = z.enum(["GUILD", "HOUSE"]);
export type PartyScope = z.infer<typeof PartyScope>;

export const AllianceRole = z.enum(["alliance_lord", "alliance_steward", "alliance_member"]);
export type AllianceRole = z.infer<typeof AllianceRole>;

export const GuildRole = z.enum([
  "guild_master",
  "guild_elder",
  "staff",
  "supplier",
  "customer",
  "franchisee",
  "org_admin",
  "agui_user",
  "guild_member",
]);
export type GuildRole = z.infer<typeof GuildRole>;

export const HouseRole = z.enum(["house_owner", "house_manager", "house_staff"]);
export type HouseRole = z.infer<typeof HouseRole>;

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
