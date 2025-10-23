import { getSupabase } from "@/lib/supabase";
import { guildTypeValues, type GuildType } from "@/lib/types/taxonomy";

import { FALLBACK_GUILD_STATS, FALLBACK_GUILD_SUMMARIES } from "./fallback";
type GuildSummaryInput = {
  id: string;
  slug: string;
  name: string;
  guild_type: GuildType;
  motto: string | null;
};

export type GuildSummary = GuildSummaryInput;

function isGuildType(value: unknown): value is GuildSummary["guild_type"] {
  return typeof value === "string" && guildTypeValues.includes(value as GuildType);
}

export function parseGuildSummary(value: unknown): GuildSummary | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const { id, slug, name, guild_type, motto } = record;

  if (
    typeof id !== "string" ||
    typeof slug !== "string" ||
    typeof name !== "string" ||
    !isGuildType(guild_type)
  ) {
    return null;
  }

  if (motto !== null && typeof motto !== "string" && typeof motto !== "undefined") {
    return null;
  }

  return {
    id,
    slug,
    name,
    guild_type,
    motto: typeof motto === "string" ? motto : null,
  } satisfies GuildSummaryInput;
}

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

const FALLBACK_STATS_BY_SLUG: Record<string, GuildStats> = FALLBACK_GUILD_STATS;

function getFallbackDetail(slug: string): GuildDetail | null {
  const summary = FALLBACK_SUMMARIES_BY_SLUG.get(slug);
  if (!summary) {
    return null;
  }

  const stats = FALLBACK_STATS_BY_SLUG[slug] ?? EMPTY_STATS;
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

    const rows = Array.isArray(data) ? data : [];
    const parsed = rows
      .map((entry) => parseGuildSummary(entry))
      .filter((entry): entry is GuildSummary => entry !== null);

    if (parsed.length !== rows.length) {
      console.warn("Failed to parse guild summaries", data);
      return FALLBACK_SUMMARIES;
    }

    return parsed;
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

    const parsed = parseGuildSummary(data);
    if (!parsed) {
      console.warn(`Failed to parse guild detail for ${slug}`, data);
      return getFallbackDetail(slug);
    }

    const stats = await fetchGuildStats(supabase, parsed.id);
    return { ...parsed, stats };
  } catch (error) {
    console.warn(`Failed to load guild detail for ${slug}`, error);
    return getFallbackDetail(slug);
  }
}
