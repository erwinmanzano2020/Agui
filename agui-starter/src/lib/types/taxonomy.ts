export const entityIdentifierTypeValues = ["EMAIL", "PHONE"] as const;
export type EntityIdentifierType = (typeof entityIdentifierTypeValues)[number];

export const guildTypeValues = ["MERCHANT", "ADVENTURER", "APOTHECARY"] as const;
export type GuildType = (typeof guildTypeValues)[number];

export const houseTypeValues = [
  "RETAIL",
  "MANUFACTURER",
  "BRAND",
  "SERVICE",
  "WHOLESALE",
  "DISTRIBUTOR",
] as const;
export type HouseType = (typeof houseTypeValues)[number];

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
