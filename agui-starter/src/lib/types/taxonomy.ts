import { z } from "zod";

export const entityIdentifierTypeValues = ["EMAIL", "PHONE"] as const;
export const EntityIdentifierTypeSchema = z.enum(entityIdentifierTypeValues);
export type EntityIdentifierType = z.infer<typeof EntityIdentifierTypeSchema>;

export const guildTypeValues = ["MERCHANT", "ADVENTURER", "APOTHECARY"] as const;
export const GuildTypeSchema = z.enum(guildTypeValues);
export type GuildType = z.infer<typeof GuildTypeSchema>;

export const houseTypeValues = [
  "RETAIL",
  "MANUFACTURER",
  "BRAND",
  "SERVICE",
  "WHOLESALE",
  "DISTRIBUTOR",
] as const;
export const HouseTypeSchema = z.enum(houseTypeValues);
export type HouseType = z.infer<typeof HouseTypeSchema>;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ])
);

export const JsonObjectSchema = z.record(JsonValueSchema);

export const EntitySchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  profile: JsonObjectSchema,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type Entity = z.infer<typeof EntitySchema>;

export const EntityIdentifierSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid(),
  identifier_type: EntityIdentifierTypeSchema,
  identifier_value: z.string(),
  is_primary: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
});
export type EntityIdentifier = z.infer<typeof EntityIdentifierSchema>;

export const AllianceSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  name: z.string(),
  motto: z.string().nullable(),
  crest: JsonObjectSchema,
  metadata: JsonObjectSchema,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type Alliance = z.infer<typeof AllianceSchema>;

export const AllianceGuildSchema = z.object({
  id: z.string().uuid(),
  alliance_id: z.string().uuid(),
  guild_id: z.string().uuid(),
  joined_at: z.string().datetime({ offset: true }),
});
export type AllianceGuild = z.infer<typeof AllianceGuildSchema>;

export const AllianceRoleSchema = z.object({
  id: z.string().uuid(),
  alliance_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  role: z.string(),
  granted_at: z.string().datetime({ offset: true }),
  granted_by: z.string().uuid().nullable(),
  metadata: JsonObjectSchema,
});
export type AllianceRole = z.infer<typeof AllianceRoleSchema>;

export const GuildSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid().nullable(),
  slug: z.string(),
  name: z.string(),
  guild_type: GuildTypeSchema,
  motto: z.string().nullable(),
  profile: JsonObjectSchema,
  theme: JsonObjectSchema,
  modules: JsonObjectSchema,
  payroll: JsonObjectSchema,
  metadata: JsonObjectSchema,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type Guild = z.infer<typeof GuildSchema>;

export const GuildRoleSchema = z.object({
  id: z.string().uuid(),
  guild_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  role: z.string(),
  granted_at: z.string().datetime({ offset: true }),
  granted_by: z.string().uuid().nullable(),
  metadata: JsonObjectSchema,
});
export type GuildRole = z.infer<typeof GuildRoleSchema>;

export const HouseSchema = z.object({
  id: z.string().uuid(),
  guild_id: z.string().uuid(),
  house_type: HouseTypeSchema,
  slug: z.string().nullable(),
  name: z.string(),
  motto: z.string().nullable(),
  crest: JsonObjectSchema,
  metadata: JsonObjectSchema,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type House = z.infer<typeof HouseSchema>;

export const HouseRoleSchema = z.object({
  id: z.string().uuid(),
  house_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  role: z.string(),
  granted_at: z.string().datetime({ offset: true }),
  granted_by: z.string().uuid().nullable(),
  metadata: JsonObjectSchema,
});
export type HouseRole = z.infer<typeof HouseRoleSchema>;

export const PartySchema = z.object({
  id: z.string().uuid(),
  guild_id: z.string().uuid().nullable(),
  house_id: z.string().uuid().nullable(),
  slug: z.string().nullable(),
  name: z.string(),
  purpose: z.string().nullable(),
  metadata: JsonObjectSchema,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type Party = z.infer<typeof PartySchema>;

export const PartyMemberSchema = z.object({
  id: z.string().uuid(),
  party_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  role: z.string().nullable(),
  joined_at: z.string().datetime({ offset: true }),
  metadata: JsonObjectSchema,
});
export type PartyMember = z.infer<typeof PartyMemberSchema>;

export const OrgAsGuildSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  guild_type: GuildTypeSchema,
  theme: JsonObjectSchema,
  modules: JsonObjectSchema,
  payroll: JsonObjectSchema,
  profile: JsonObjectSchema,
  metadata: JsonObjectSchema,
  entity_id: z.string().uuid().nullable(),
  motto: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  source: z.union([z.literal("guilds"), z.literal("orgs")]),
});
export type OrgAsGuild = z.infer<typeof OrgAsGuildSchema>;
