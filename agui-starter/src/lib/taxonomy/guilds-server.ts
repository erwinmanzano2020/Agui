import type { SupabaseClient } from "@supabase/supabase-js";

import type { GuildType } from "@/lib/types/taxonomy";

const DEFAULT_GUILD_TYPE: GuildType = "MERCHANT";

export type GuildRecord = {
  id: string;
  name: string;
  slug: string;
};

type OrgAsGuildRow = {
  id: string;
  name: string;
  slug: string;
  source: string | null;
  guild_type: string | null;
  motto: string | null;
  profile: Record<string, unknown> | null;
  theme: Record<string, unknown> | null;
  modules: Record<string, unknown> | null;
  payroll: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

function normalizeGuildType(value: string | null): GuildType {
  if (value === "MERCHANT" || value === "ADVENTURER" || value === "APOTHECARY") {
    return value;
  }
  return DEFAULT_GUILD_TYPE;
}

export async function ensureGuildRecord(
  supabase: SupabaseClient,
  slug: string,
): Promise<GuildRecord | null> {
  const { data: guildRow, error: guildError } = await supabase
    .from("orgs_as_guilds")
    .select(
      "id,name,slug,source,guild_type,motto,profile,theme,modules,payroll,metadata",
    )
    .eq("slug", slug)
    .maybeSingle<OrgAsGuildRow>();

  if (guildError) {
    throw new Error(`Failed to resolve guild with slug ${slug}: ${guildError.message}`);
  }

  if (!guildRow) {
    return null;
  }

  if (guildRow.source === "orgs") {
    const guildType = normalizeGuildType(guildRow.guild_type);
    const { data: ensuredGuild, error: ensureGuildError } = await supabase
      .from("guilds")
      .upsert(
        {
          slug: guildRow.slug,
          name: guildRow.name,
          guild_type: guildType,
          motto: guildRow.motto,
          profile: guildRow.profile ?? {},
          theme: guildRow.theme ?? {},
          modules: guildRow.modules ?? {},
          payroll: guildRow.payroll ?? {},
          metadata: guildRow.metadata ?? {},
        },
        { onConflict: "slug" },
      )
      .select("id,name,slug")
      .single<GuildRecord>();

    if (ensureGuildError) {
      throw new Error(
        `Failed to promote org slug ${slug} to a guild: ${ensureGuildError.message}`,
      );
    }

    if (!ensuredGuild) {
      throw new Error(`No guild record returned while promoting slug ${slug}`);
    }

    return ensuredGuild;
  }

  return { id: guildRow.id, name: guildRow.name, slug: guildRow.slug } satisfies GuildRecord;
}
