import { z } from "zod";

import { getSupabase } from "@/lib/supabase";
import { OrgAsGuildSchema } from "@/lib/types/taxonomy";

import { FALLBACK_GUILD_STATS, FALLBACK_GUILD_SUMMARIES } from "./fallback";

export const GuildSummarySchema = OrgAsGuildSchema.pick({
  id: true,
  slug: true,
  name: true,
  guild_type: true,
  motto: true,
});

export type GuildSummary = z.infer<typeof GuildSummarySchema>;

export type GuildStats = {
  memberCount: number;
  houseCount: number;
  partyCount: number;
};

export type GuildDetail = GuildSummary & { stats: GuildStats };

const GUILD_TYPE_LABELS: Record<GuildSummary["guild_type"], string> = {
  MERCHANT: "Merchant",
  ADVENTURER: "Adventurer",
  APOTHECARY: "Apothecary",
};

export function formatGuildType(type: GuildSummary["guild_type"]): string {
  return GUILD_TYPE_LABELS[type] ?? type;
}

const FALLBACK_SUMMARIES: GuildSummary[] = FALLBACK_GUILD_SUMMARIES.map((entry) => ({
  id: entry.id,
  slug: entry.slug,
  name: entry.name,
  guild_type: entry.guild_type,
  motto: entry.motto ?? null,
}));

const FALLBACK_SUMMARIES_BY_SLUG = new Map(
  FALLBACK_SUMMARIES.map((summary) => [summary.slug, summary] as const)
);

const EMPTY_STATS: GuildStats = { memberCount: 0, houseCount: 0, partyCount: 0 };

function getFallbackDetail(slug: string): GuildDetail | null {
  const summary = FALLBACK_SUMMARIES_BY_SLUG.get(slug);
  if (!summary) {
    return null;
  }

  const stats = FALLBACK_GUILD_STATS[slug] ?? EMPTY_STATS;
  return { ...summary, stats };
}

async function fetchGuildStats(
  supabase: ReturnType<typeof getSupabase>,
  guildId: string
): Promise<GuildStats> {
  if (!supabase) {
    return EMPTY_STATS;
  }

  try {
    const [members, houses, parties] = await Promise.all([
      supabase
        .from("guild_roles")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", guildId),
      supabase
        .from("houses")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", guildId),
      supabase
        .from("parties")
        .select("id", { count: "exact", head: true })
        .eq("guild_id", guildId),
    ]);

    const memberCount = members.error ? 0 : members.count ?? 0;
    const houseCount = houses.error ? 0 : houses.count ?? 0;
    const partyCount = parties.error ? 0 : parties.count ?? 0;

    if (members.error) {
      console.warn("Failed to load guild member count", members.error);
    }
    if (houses.error) {
      console.warn("Failed to load guild house count", houses.error);
    }
    if (parties.error) {
      console.warn("Failed to load guild party count", parties.error);
    }

    return { memberCount, houseCount, partyCount };
  } catch (error) {
    console.warn("Failed to load guild stats", error);
    return EMPTY_STATS;
  }
}

export async function loadGuildSummaries(): Promise<GuildSummary[]> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return FALLBACK_SUMMARIES;
    }

    const { data, error } = await supabase
      .from("orgs_as_guilds")
      .select("id,name,slug,guild_type,motto")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Failed to load guild summaries", error);
      return FALLBACK_SUMMARIES;
    }

    const parsed = GuildSummarySchema.array().safeParse(data);
    if (!parsed.success) {
      console.warn("Failed to parse guild summaries", parsed.error);
      return FALLBACK_SUMMARIES;
    }

    return parsed.data;
  } catch (error) {
    console.warn("Failed to load guild summaries", error);
    return FALLBACK_SUMMARIES;
  }
}

export async function loadGuildDetail(slug: string): Promise<GuildDetail | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return getFallbackDetail(slug);
    }

    const { data, error } = await supabase
      .from("orgs_as_guilds")
      .select("id,name,slug,guild_type,motto")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.warn(`Failed to load guild detail for ${slug}`, error);
      return getFallbackDetail(slug);
    }

    if (!data) {
      return getFallbackDetail(slug);
    }

    const parsed = GuildSummarySchema.safeParse(data);
    if (!parsed.success) {
      console.warn(`Failed to parse guild detail for ${slug}`, parsed.error);
      return getFallbackDetail(slug);
    }

    const stats = await fetchGuildStats(supabase, parsed.data.id);
    return { ...parsed.data, stats };
  } catch (error) {
    console.warn(`Failed to load guild detail for ${slug}`, error);
    return getFallbackDetail(slug);
  }
}
