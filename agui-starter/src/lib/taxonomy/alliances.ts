import { getSupabase } from "@/lib/supabase";

import { FALLBACK_ALLIANCES, FALLBACK_GUILD_SUMMARIES } from "./fallback";
import { GuildSummary, parseGuildSummary } from "./guilds";

export type AllianceSummary = {
  id: string;
  slug: string | null;
  name: string;
  motto: string | null;
};

export type AllianceDetail = AllianceSummary & { guilds: GuildSummary[] };

function parseAllianceSummary(value: unknown): AllianceSummary | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const { id, slug, name, motto } = record;

  if (typeof id !== "string" || typeof name !== "string") {
    return null;
  }

  if (slug !== null && typeof slug !== "string" && typeof slug !== "undefined") {
    return null;
  }

  if (motto !== null && typeof motto !== "string" && typeof motto !== "undefined") {
    return null;
  }

  return {
    id,
    slug: typeof slug === "string" ? slug : null,
    name,
    motto: typeof motto === "string" ? motto : null,
  } satisfies AllianceSummary;
}

const FALLBACK_GUILD_BY_SLUG = new Map<string, GuildSummary>(
  FALLBACK_GUILD_SUMMARIES.map((guild) => [
    guild.slug,
    {
      id: guild.id,
      slug: guild.slug,
      name: guild.name,
      guild_type: guild.guild_type,
      motto: guild.motto ?? null,
    },
  ]),
);

const FALLBACK_SUMMARIES: AllianceSummary[] = FALLBACK_ALLIANCES.map((entry) => ({
  id: entry.id,
  slug: entry.slug,
  name: entry.name,
  motto: entry.motto ?? null,
}));

const FALLBACK_DETAILS: AllianceDetail[] = FALLBACK_ALLIANCES.map((entry) => {
  const guilds = entry.guildSlugs
    .map((slug) => FALLBACK_GUILD_BY_SLUG.get(slug))
    .filter((guild): guild is GuildSummary => Boolean(guild));

  return {
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    motto: entry.motto ?? null,
    guilds,
  };
});

function getFallbackDetail(slug: string): AllianceDetail | null {
  return FALLBACK_DETAILS.find((entry) => entry.slug === slug) ?? null;
}

export async function loadAllianceSummaries(): Promise<AllianceSummary[]> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return FALLBACK_SUMMARIES;
    }

    const { data, error } = await supabase
      .from("alliances")
      .select("id,name,slug,motto")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Failed to load alliances", error);
      return FALLBACK_SUMMARIES;
    }

    const rows = Array.isArray(data) ? data : [];
    const parsed = rows
      .map((entry) => parseAllianceSummary(entry))
      .filter((entry): entry is AllianceSummary => entry !== null);

    if (parsed.length !== rows.length) {
      console.warn("Failed to parse alliance summaries", data);
      return FALLBACK_SUMMARIES;
    }

    return parsed;
  } catch (error) {
    console.warn("Failed to load alliance summaries", error);
    return FALLBACK_SUMMARIES;
  }
}

export async function loadAllianceDetail(slug: string): Promise<AllianceDetail | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return getFallbackDetail(slug);
    }

    const { data, error } = await supabase
      .from("alliances")
      .select(
        "id,name,slug,motto,alliance_guilds:alliance_guilds(guild:guilds(id,name,slug,guild_type,motto))"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.warn(`Failed to load alliance detail for ${slug}`, error);
      return getFallbackDetail(slug);
    }

    if (!data) {
      return getFallbackDetail(slug);
    }

    const { alliance_guilds, ...rest } = data as typeof data & {
      alliance_guilds?: Array<{ guild: unknown | null }>;
    };

    const summary = parseAllianceSummary(rest);
    if (!summary) {
      console.warn(`Failed to parse alliance detail for ${slug}`, rest);
      return getFallbackDetail(slug);
    }

    const guildResults = (alliance_guilds ?? []).map((entry) => parseGuildSummary(entry.guild));
    const guilds = guildResults.filter((guild): guild is GuildSummary => guild !== null);

    if (guilds.length !== guildResults.length) {
      console.warn(`Failed to parse alliance guilds for ${slug}`, alliance_guilds);
      return { ...summary, guilds: [] };
    }

    return { ...summary, guilds };
  } catch (error) {
    console.warn(`Failed to load alliance detail for ${slug}`, error);
    return getFallbackDetail(slug);
  }
}
