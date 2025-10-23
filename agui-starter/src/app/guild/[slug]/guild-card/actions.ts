"use server";

import { revalidatePath } from "next/cache";

import { getOrCreateEntityByIdentifier } from "@/lib/auth/entity";
import { issueCard, loadCardsForEntity, updateCardFlags } from "@/lib/passes/cards";
import { ensureGuildCardScheme } from "@/lib/loyalty/schemes-server";
import { ensureLoyaltyProfile } from "@/lib/loyalty/rules";
import { getSupabase } from "@/lib/supabase";
import { ensureGuildRecord } from "@/lib/taxonomy/guilds-server";
import type { EntityIdentifierType } from "@/lib/types/taxonomy";

import { INITIAL_GUILD_CARD_STATE, type IssueGuildCardState } from "./state";

function coerceString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "1";
}

function detectIdentifier(value: string): EntityIdentifierType {
  return value.includes("@") ? "EMAIL" : "PHONE";
}

export async function issueGuildCard(
  _prevState: IssueGuildCardState,
  formData: FormData,
): Promise<IssueGuildCardState> {
  try {
    const slug = coerceString(formData.get("slug"));
    if (!slug) {
      return {
        ...INITIAL_GUILD_CARD_STATE,
        status: "error",
        message: "Missing guild information. Reload this page and try again.",
      };
    }

    const contactValue = coerceString(formData.get("contact"));
    const entityIdFromForm = coerceString(formData.get("entity_id"));
    const incognitoDefault = coerceBoolean(formData.get("incognito_default"));
    const forceIssue = coerceBoolean(formData.get("force_issue"));
    const overrideReason = coerceString(formData.get("override_reason"));

    let supabase;
    try {
      supabase = getSupabase();
    } catch (error) {
      console.error("Supabase is not configured while issuing a guild card", error);
      supabase = null;
    }

    if (!supabase) {
      return {
        ...INITIAL_GUILD_CARD_STATE,
        status: "error",
        message: "Issuing cards requires an active Supabase connection.",
      };
    }

    const guild = await ensureGuildRecord(supabase, slug);
    if (!guild) {
      return {
        ...INITIAL_GUILD_CARD_STATE,
        status: "error",
        message: "This guild isn’t ready to issue cards yet.",
      };
    }

    const scheme = await ensureGuildCardScheme({ supabase, guild });

    let entityId = entityIdFromForm;
    if (!entityId && contactValue) {
      const identifierType = detectIdentifier(contactValue);
      try {
        const entity = await getOrCreateEntityByIdentifier({
          identifierType,
          identifierValue: contactValue,
          supabase,
          makePrimary: true,
        });
        entityId = entity.id;
      } catch (error) {
        console.error("Failed to resolve entity while issuing guild card", error);
        return {
          ...INITIAL_GUILD_CARD_STATE,
          status: "error",
          message: "We couldn’t resolve that contact. Check it and try again.",
        };
      }
    }

    if (!entityId) {
      return {
        ...INITIAL_GUILD_CARD_STATE,
        status: "error",
        message: "Share an email address or phone number to look up the member.",
      };
    }

    const cards = await loadCardsForEntity(entityId, { supabase });
    const higherCard = cards.find((card) => card.scheme.scope === "ALLIANCE");

    if (higherCard && !forceIssue) {
      return {
        status: "needs-override",
        message: `This member already holds the ${higherCard.scheme.name}. Continue issuing a guild card?`,
        entityId,
        higherCard: {
          scope: higherCard.scheme.scope,
          name: higherCard.scheme.name,
          cardNo: higherCard.card_no,
        },
        issuedCard: null,
      } satisfies IssueGuildCardState;
    }

    if (forceIssue && !overrideReason) {
      return {
        status: "needs-override",
        message: "Add a reason before issuing a lower-precedence card.",
        entityId,
        higherCard: higherCard
          ? {
              scope: higherCard.scheme.scope,
              name: higherCard.scheme.name,
              cardNo: higherCard.card_no,
            }
          : null,
        issuedCard: null,
      } satisfies IssueGuildCardState;
    }

    const existing = cards.find((card) => card.scheme.id === scheme.id);
    const targetIncognito = incognitoDefault && scheme.allow_incognito;

    let issued = existing ?? null;
    if (issued) {
      const currentIncognito = issued.flags.incognito_default ?? false;
      if (currentIncognito !== targetIncognito) {
        issued = await updateCardFlags(issued.id, { incognito_default: targetIncognito }, { supabase });
      }
    } else {
      issued = await issueCard({
        supabase,
        scheme,
        entityId,
        incognitoDefault: targetIncognito,
      });
    }

    try {
      await ensureLoyaltyProfile({
        schemeId: scheme.id,
        entityId,
        accountNo: issued.card_no,
      });
    } catch (error) {
      console.warn("Failed to ensure loyalty profile while issuing guild card", error);
    }

    revalidatePath(`/guild/${slug}/guild-card`);

    return {
      status: "success",
      message: `${scheme.name} ready. Card number ${issued.card_no}.`,
      entityId,
      higherCard: null,
      issuedCard: {
        cardNo: issued.card_no,
        incognitoDefault: issued.flags.incognito_default ?? false,
      },
    } satisfies IssueGuildCardState;
  } catch (error) {
    console.error("Failed to issue guild card", error);
    return {
      ...INITIAL_GUILD_CARD_STATE,
      status: "error",
      message: "We couldn’t issue that card right now. Try again later.",
    };
  }
}
