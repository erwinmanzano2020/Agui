import type { GuildType } from "@/lib/types/taxonomy";

export const FALLBACK_GUILD_SUMMARIES = [
  {
    id: "00000000-0000-0000-0000-00000000cafe",
    slug: "vangie-guild",
    name: "Vangie Guild",
    guild_type: "MERCHANT",
    motto: "Merchant network for general stores across Kalinga.",
  },
  {
    id: "00000000-0000-0000-0000-00000000beef",
    slug: "lunaria-circle",
    name: "Lunaria Circle",
    guild_type: "APOTHECARY",
    motto: "Herbal care collective keeping travelers healthy.",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  slug: string;
  name: string;
  guild_type: GuildType;
  motto: string;
}>;

export const FALLBACK_GUILD_STATS = {
  "vangie-guild": { memberCount: 18, houseCount: 3, partyCount: 4 },
  "lunaria-circle": { memberCount: 9, houseCount: 2, partyCount: 3 },
} satisfies Record<string, { memberCount: number; houseCount: number; partyCount: number }>;

export const FALLBACK_ALLIANCES = [
  {
    id: "00000000-0000-0000-0000-00000000feed",
    slug: "kalinga-retail-alliance",
    name: "Kalinga Retail Alliance",
    motto: "Mutual aid pact for frontier merchants.",
    guildSlugs: ["vangie-guild", "lunaria-circle"] as const,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  slug: string;
  name: string;
  motto: string;
  guildSlugs: readonly string[];
}>;
