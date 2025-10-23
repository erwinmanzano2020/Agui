"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentEntity } from "@/lib/auth/entity";
import { getSupabase } from "@/lib/supabase";
import { ensureGuildRecord } from "@/lib/taxonomy/guilds-server";
import { uniqueSlug } from "@/lib/slug";
import { houseTypeValues, type HouseType } from "@/lib/types/taxonomy";

const HOUSE_OWNER_ROLE = "house_owner";

const PARTY_SEEDS: Record<
  string,
  { name: string; slug: string; purpose: string; metadata: Record<string, unknown> }
> = {
  departments: {
    name: "Departments",
    slug: "departments",
    purpose: "Organize teams by department or discipline.",
    metadata: { seed_template: "departments" },
  },
  branches: {
    name: "Branches",
    slug: "branches",
    purpose: "Track regional branches or storefront clusters.",
    metadata: { seed_template: "branches" },
  },
};

function coerceString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseHouseType(value: FormDataEntryValue | null): HouseType | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toUpperCase();
  return houseTypeValues.includes(candidate as HouseType) ? (candidate as HouseType) : null;
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "1";
}

function buildErrorRedirect(slug: string | null, message: string): never {
  const params = new URLSearchParams();
  params.set("error", message);
  const destination = slug ? `/guild/${slug}/companies/new?${params.toString()}` : `/guilds?${params.toString()}`;
  redirect(destination);
}

async function isHouseSlugAvailable(
  supabase: SupabaseClient,
  guildId: string,
  slug: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("houses")
    .select("id")
    .eq("guild_id", guildId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check house slug availability: ${error.message}`);
  }

  return !data;
}

async function isPartySlugAvailable(
  supabase: SupabaseClient,
  houseId: string,
  slug: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("parties")
    .select("id")
    .eq("house_id", houseId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check party slug availability: ${error.message}`);
  }

  return !data;
}

function buildHouseMetadata(address: Record<string, string | null>, taxFlags: Record<string, boolean>) {
  const filteredAddress = Object.fromEntries(
    Object.entries(address).filter(([, value]) => {
      if (typeof value !== "string") return false;
      return value.trim().length > 0;
    }),
  );

  const metadata: Record<string, unknown> = {};
  if (Object.keys(filteredAddress).length > 0) {
    metadata.address = filteredAddress;
  }
  metadata.tax_flags = taxFlags;
  return metadata;
}

export async function createHouse(formData: FormData): Promise<void> {
  const guildSlug = coerceString(formData.get("guild_slug"));
  if (!guildSlug) {
    buildErrorRedirect(null, "Missing guild context. Start from a guild to create a company.");
  }

  const name = coerceString(formData.get("name"));
  if (!name) {
    buildErrorRedirect(guildSlug, "Enter a name for the new company.");
  }

  const houseType = parseHouseType(formData.get("house_type"));
  if (!houseType) {
    buildErrorRedirect(guildSlug, "Select a company type before continuing.");
  }

  let supabase: SupabaseClient;
  try {
    const client = getSupabase();
    if (!client) {
      buildErrorRedirect(guildSlug, "Supabase is offline, so we can’t create a company right now.");
      return; // satisfy TypeScript
    }
    supabase = client;
  } catch (cause) {
    console.error("Supabase is not configured", cause);
    buildErrorRedirect(guildSlug, "Supabase is not configured. Configure Supabase to create companies.");
  }

  let guildRecord;
  try {
    guildRecord = await ensureGuildRecord(supabase, guildSlug);
  } catch (cause) {
    console.error(`Failed to resolve guild before creating house`, cause);
    buildErrorRedirect(guildSlug, "We couldn’t load that guild right now. Please try again later.");
  }

  if (!guildRecord) {
    buildErrorRedirect(guildSlug, "This guild isn’t ready to host companies yet.");
  }

  const entity = await getCurrentEntity({ supabase });
  if (!entity) {
    buildErrorRedirect(guildSlug, "Sign in to create a company for this guild.");
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("guild_roles")
    .select("id")
    .eq("guild_id", guildRecord.id)
    .eq("entity_id", entity.id)
    .maybeSingle();

  if (membershipError) {
    console.error("Failed to verify guild membership before creating a house", membershipError);
    buildErrorRedirect(guildSlug, "We couldn’t verify your guild membership just now. Try again later.");
  }

  if (!membershipRow) {
    buildErrorRedirect(guildSlug, "Only guild members can create companies for this guild.");
  }

  const address = {
    line1: coerceString(formData.get("address_line1")),
    line2: coerceString(formData.get("address_line2")),
    city: coerceString(formData.get("address_city")),
    region: coerceString(formData.get("address_region")),
    postal_code: coerceString(formData.get("address_postal_code")),
    country: coerceString(formData.get("address_country")),
  } satisfies Record<string, string | null>;

  const taxFlags = {
    vat_registered: parseBoolean(formData.get("tax_vat_registered")),
    tax_exempt_sales: parseBoolean(formData.get("tax_exempt_sales")),
  } satisfies Record<string, boolean>;

  const seedPartyValues = formData
    .getAll("seed_parties")
    .flatMap((entry) => (typeof entry === "string" ? entry : []))
    .filter((value, index, list) => list.indexOf(value) === index);

  let houseSlug: string;
  try {
    houseSlug = await uniqueSlug(name, {
      isAvailable: (candidate) => isHouseSlugAvailable(supabase, guildRecord.id, candidate),
      fallback: "company",
    });
  } catch (cause) {
    console.error("Failed to generate unique house slug", cause);
    buildErrorRedirect(guildSlug, "We couldn’t generate a unique company slug. Try a different name.");
  }

  const metadata = buildHouseMetadata(address, taxFlags);

  const { data: insertedHouse, error: insertError } = await supabase
    .from("houses")
    .insert({
      guild_id: guildRecord.id,
      name,
      slug: houseSlug,
      house_type: houseType,
      metadata,
    })
    .select("id,slug")
    .single();

  if (insertError || !insertedHouse) {
    console.error("Failed to create house", insertError);
    buildErrorRedirect(guildSlug, "We couldn’t create that company. Please try again later.");
  }

  const { error: roleError } = await supabase
    .from("house_roles")
    .upsert(
      {
        house_id: insertedHouse.id,
        entity_id: entity.id,
        role: HOUSE_OWNER_ROLE,
        metadata: { source: "company_create_form" },
      },
      { onConflict: "house_id,entity_id,role", ignoreDuplicates: true },
    );

  if (roleError) {
    console.error("Failed to assign house owner role", roleError);
    buildErrorRedirect(guildSlug, "We created the company but couldn’t assign ownership. Try again.");
  }

  for (const seed of seedPartyValues) {
    const definition = PARTY_SEEDS[seed];
    if (!definition) continue;

    try {
      const partySlug = await uniqueSlug(definition.slug, {
        isAvailable: (candidate) => isPartySlugAvailable(supabase, insertedHouse.id, candidate),
        fallback: definition.slug,
      });

      const { error: partyError } = await supabase.from("parties").insert({
        house_id: insertedHouse.id,
        name: definition.name,
        slug: partySlug,
        purpose: definition.purpose,
        metadata: { ...definition.metadata, seed: true },
      });

      if (partyError) {
        console.error(`Failed to seed party ${seed}`, partyError);
      }
    } catch (cause) {
      console.error(`Failed to seed party ${seed}`, cause);
    }
  }

  revalidatePath(`/guild/${guildSlug}`);
  revalidatePath(`/guild/${guildSlug}/companies/new`);
  revalidatePath(`/company/${insertedHouse.slug}`);

  redirect(`/company/${insertedHouse.slug}`);
}
