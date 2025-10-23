import type { SupabaseClient } from "@supabase/supabase-js";

import type { GuildRecord } from "@/lib/taxonomy/guilds-server";

import { createLoyaltyScheme, parseLoyaltyScheme, type LoyaltyScheme } from "./rules";

type HouseReference = {
  id: string;
  name: string;
  slug: string | null;
  guild_id: string;
};

type FetchOptions = {
  supabase: SupabaseClient;
};

function formatGuildCardName(guild: GuildRecord): string {
  return guild.name ? `${guild.name} Guild Card` : "Guild Card";
}

function formatHousePassName(house: HouseReference, fallback: string): string {
  if (house.name) {
    return `${house.name} ${fallback}`;
  }
  return fallback;
}

export async function ensureMemberPassScheme({
  supabase,
  displayName = "Member Pass",
}: FetchOptions & { displayName?: string }): Promise<LoyaltyScheme> {
  const { data, error } = await supabase
    .from("loyalty_schemes")
    .select("*")
    .eq("scope", "ALLIANCE")
    .order("precedence", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve member pass scheme: ${error.message}`);
  }

  if (data) {
    return parseLoyaltyScheme(data);
  }

  return createLoyaltyScheme({
    scope: "ALLIANCE",
    name: displayName,
    precedence: 0,
    allow_incognito: true,
    design: { key: "member_pass" },
  });
}

export async function ensureGuildCardScheme({
  supabase,
  guild,
}: FetchOptions & { guild: GuildRecord }): Promise<LoyaltyScheme> {
  const { data, error } = await supabase
    .from("loyalty_schemes")
    .select("*")
    .eq("scope", "GUILD")
    .contains("design", { guild_id: guild.id })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve guild card scheme: ${error.message}`);
  }

  if (data) {
    return parseLoyaltyScheme(data);
  }

  const name = formatGuildCardName(guild);

  const { data: inserted, error: insertError } = await supabase
    .from("loyalty_schemes")
    .insert({
      scope: "GUILD",
      name,
      precedence: 1,
      allow_incognito: true,
      design: { guild_id: guild.id, guild_slug: guild.slug },
    })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`Failed to create guild card scheme: ${insertError.message}`);
  }

  return parseLoyaltyScheme(inserted);
}

export async function ensureHousePassScheme({
  supabase,
  house,
  housePassLabel = "Patron Pass",
}: FetchOptions & { house: HouseReference; housePassLabel?: string }): Promise<LoyaltyScheme> {
  const { data, error } = await supabase
    .from("loyalty_schemes")
    .select("*")
    .eq("scope", "HOUSE")
    .contains("design", { house_id: house.id })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve house pass scheme: ${error.message}`);
  }

  if (data) {
    return parseLoyaltyScheme(data);
  }

  const name = formatHousePassName(house, housePassLabel);

  const { data: inserted, error: insertError } = await supabase
    .from("loyalty_schemes")
    .insert({
      scope: "HOUSE",
      name,
      precedence: 2,
      allow_incognito: true,
      design: {
        house_id: house.id,
        house_slug: house.slug,
        guild_id: house.guild_id,
      },
    })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`Failed to create house pass scheme: ${insertError.message}`);
  }

  return parseLoyaltyScheme(inserted);
}
