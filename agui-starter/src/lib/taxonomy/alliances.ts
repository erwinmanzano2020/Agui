import { z } from "zod";

import { getSupabase } from "@/lib/supabase";
import { AllianceSchema } from "@/lib/types/taxonomy";

import { FALLBACK_ALLIANCES, FALLBACK_GUILD_SUMMARIES } from "./fallback";
import { GuildSummary, GuildSummarySchema } from "./guilds";

export const AllianceSummarySchema = AllianceSchema.pick({
  id: true,
  slug: true,
  name: true,
  motto: true,
});

export type AllianceSummary = z.infer<typeof AllianceSummarySchema>;

export type AllianceDetail = AllianceSummary & { guilds: GuildSummary[] };

const FALLBACK_GUILD_BY_SLUG = new Map(
  FALLBACK_GUILD_SUMMARIES.map((guild) => [
    guild.slug,
    GuildSummarySchema.parse({
      id: guild.id,
      slug: guild.slug,
      name: guild.name,
      guild_type: guild.guild_type,
      motto: guild.motto ?? null,
    }),
  ])
);

const FALLBACK_SUMMARIES: AllianceSummary[] = FALLBACK_ALLIANCES.map((entry) => ({
  id: entry.id,
  slug: entry.slug,
  name: entry.name,
  motto: entry.motto ?? null,
}));

const FALLBACK_DETAILS: AllianceDetail[] = FALLBACK_ALLIANCES.map((entry) => ({
  id: entry.id,
  slug: entry.slug,
  name: entry.name,
  motto: entry.motto ?? null,
  guilds: entry.guildSlugs
    .map((slug) => FALLBACK_GUILD_BY_SLUG.get(slug))
    .filter((guild): guild is GuildSummary => Boolean(guild)),
}));

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

    const parsed = AllianceSummarySchema.array().safeParse(data);
    if (!parsed.success) {
      console.warn("Failed to parse alliance summaries", parsed.error);
      return FALLBACK_SUMMARIES;
    }

    return parsed.data;
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

    const summary = AllianceSummarySchema.safeParse(rest);
    if (!summary.success) {
      console.warn(`Failed to parse alliance detail for ${slug}`, summary.error);
      return getFallbackDetail(slug);
    }

    const guildRows = (alliance_guilds ?? [])
      .map((entry) => entry.guild)
      .filter((guild): guild is Record<string, unknown> => Boolean(guild));

    const guilds = GuildSummarySchema.array().safeParse(guildRows);
    if (!guilds.success) {
      console.warn(`Failed to parse alliance guilds for ${slug}`, guilds.error);
      return { ...summary.data, guilds: [] };
    }

    return { ...summary.data, guilds: guilds.data };
  } catch (error) {
    console.warn(`Failed to load alliance detail for ${slug}`, error);
    return getFallbackDetail(slug);
  }
}
