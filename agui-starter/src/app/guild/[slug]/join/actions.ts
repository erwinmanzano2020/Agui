"use server";

import { revalidatePath } from "next/cache";

import { getOrCreateEntityByIdentifier } from "@/lib/auth/entity";
import { getSupabase } from "@/lib/supabase";
import type { EntityIdentifierType } from "@/lib/types/taxonomy";

import type { ApplyToGuildFormState } from "./state";

function coerceString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseIdentifierType(value: FormDataEntryValue | null): EntityIdentifierType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "EMAIL" || normalized === "PHONE") {
    return normalized as EntityIdentifierType;
  }

  return null;
}

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

export async function applyToGuild(
  _prevState: ApplyToGuildFormState,
  formData: FormData,
): Promise<ApplyToGuildFormState> {
  try {
    const slug = coerceString(formData.get("slug"));
    if (!slug) {
      return {
        status: "error",
        message: "Missing guild information. Try applying again from the guild page.",
      };
    }

    let supabase;
    try {
      supabase = getSupabase();
    } catch (cause) {
      console.error("Supabase is not configured", cause);
      return {
        status: "error",
        message: "Membership requires a Supabase connection. Please configure Supabase and try again.",
      };
    }

    if (!supabase) {
      return {
        status: "error",
        message: "Membership is currently unavailable because Supabase is offline.",
      };
    }

    const { data: guildRow, error: guildError } = await supabase
      .from("orgs_as_guilds")
      .select(
        "id,name,slug,source,guild_type,motto,profile,theme,modules,payroll,metadata",
      )
      .eq("slug", slug)
      .maybeSingle<OrgAsGuildRow>();

    if (guildError) {
      console.error(`Failed to resolve guild with slug ${slug}`, guildError);
      return {
        status: "error",
        message: "We couldn’t look up that guild right now. Please try again in a moment.",
      };
    }

    if (!guildRow) {
      return {
        status: "error",
        message: "This guild isn’t ready to accept new members yet.",
      };
    }

    let guildId = guildRow.id;
    let guildName = guildRow.name;

    if (guildRow.source === "orgs") {
      const { data: ensuredGuild, error: ensureGuildError } = await supabase
        .from("guilds")
        .upsert(
          {
            slug: guildRow.slug,
            name: guildRow.name,
            guild_type: guildRow.guild_type ?? "MERCHANT",
            motto: guildRow.motto,
            profile: guildRow.profile ?? {},
            theme: guildRow.theme ?? {},
            modules: guildRow.modules ?? {},
            payroll: guildRow.payroll ?? {},
            metadata: guildRow.metadata ?? {},
          },
          { onConflict: "slug" },
        )
        .select("id,name")
        .single();

      if (ensureGuildError) {
        console.error(
          `Failed to promote org slug ${slug} to a guild before granting membership`,
          ensureGuildError,
        );
        return {
          status: "error",
          message: "We couldn’t finalize that guild for instant membership just yet. Please try again later.",
        };
      }

      if (!ensuredGuild) {
        console.error(
          `Received no guild record after attempting to promote org slug ${slug} to a guild`,
        );
        return {
          status: "error",
          message: "We couldn’t finalize that guild for instant membership just yet. Please try again later.",
        };
      }

      guildId = ensuredGuild.id;
      guildName = ensuredGuild.name;
    }

    let entityId = coerceString(formData.get("entity_id"));
    let identifierType: EntityIdentifierType | null = null;
    let identifierValue: string | null = null;

    if (!entityId) {
      const explicitType = parseIdentifierType(formData.get("identifier_type"));
      const explicitValue = coerceString(formData.get("identifier_value"));
      if (explicitType && explicitValue) {
        identifierType = explicitType;
        identifierValue = explicitValue;
      }
    }

    if (!entityId && !identifierValue) {
      const email = coerceString(formData.get("email"));
      if (email) {
        identifierType = "EMAIL";
        identifierValue = email;
      } else {
        const phone = coerceString(formData.get("phone"));
        if (phone) {
          identifierType = "PHONE";
          identifierValue = phone;
        }
      }
    }

    if (!entityId && (!identifierType || !identifierValue)) {
      return {
        status: "error",
        message: "Share an email address or phone number so we can register your membership.",
      };
    }

    if (!entityId && identifierType && identifierValue) {
      try {
        const entity = await getOrCreateEntityByIdentifier({
          identifierType,
          identifierValue,
          supabase,
          makePrimary: true,
        });
        entityId = entity.id;
      } catch (cause) {
        console.error("Failed to resolve entity for join request", cause);
        return {
          status: "error",
          message: "We couldn’t resolve your contact information. Double-check it and try again.",
        };
      }
    }

    if (!entityId) {
      return {
        status: "error",
        message: "We couldn’t resolve your membership information. Please try again.",
      };
    }

    const { error: upsertError } = await supabase
      .from("guild_roles")
      .upsert(
        { guild_id: guildId, entity_id: entityId, role: "guild_member" },
        { onConflict: "guild_id,entity_id,role", ignoreDuplicates: true },
      );

    if (upsertError) {
      console.error(
        `Failed to grant guild membership for entity ${entityId} on guild ${guildId}`,
        upsertError,
      );
      return {
        status: "error",
        message: "We couldn’t record your membership just yet. Please try again later.",
      };
    }

    revalidatePath(`/guild/${slug}`);
    revalidatePath(`/guild/${slug}/join`);

    return {
      status: "success",
      message: `You’re now a member of ${guildName}!`,
    };
  } catch (cause) {
    console.error("Unexpected error while applying to a guild", cause);
    return {
      status: "error",
      message: "Something went wrong while processing your application.",
    };
  }
}
