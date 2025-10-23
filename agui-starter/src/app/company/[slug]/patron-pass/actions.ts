"use server";

import { revalidatePath } from "next/cache";

import { getCurrentEntity, getOrCreateEntityByIdentifier } from "@/lib/auth/entity";
import { issueCard, loadCardsForEntity, updateCardFlags } from "@/lib/passes/cards";
import { ensureHousePassScheme } from "@/lib/loyalty/schemes-server";
import { ensureLoyaltyProfile } from "@/lib/loyalty/rules";
import { getSupabase } from "@/lib/supabase";
import { loadHouseBySlug } from "@/lib/taxonomy/houses-server";
import type { EntityIdentifierType } from "@/lib/types/taxonomy";

import { INITIAL_PATRON_PASS_STATE, type IssuePatronPassState } from "./state";

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

export async function issuePatronPass(
  _prevState: IssuePatronPassState,
  formData: FormData,
): Promise<IssuePatronPassState> {
  try {
    const slug = coerceString(formData.get("slug"));
    if (!slug) {
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "Missing company information. Reload this page and try again.",
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
      console.error("Supabase is not configured while issuing a patron pass", error);
      supabase = null;
    }

    if (!supabase) {
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "Issuing passes requires an active Supabase connection.",
      };
    }

    const house = await loadHouseBySlug(supabase, slug);
    if (!house) {
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "This company isn’t ready to issue passes yet.",
      };
    }

    let currentEntity: Awaited<ReturnType<typeof getCurrentEntity>>;
    try {
      currentEntity = await getCurrentEntity({ supabase });
    } catch (error) {
      console.error("Failed to resolve current entity before issuing patron pass", error);
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "We couldn’t confirm who’s issuing this pass. Refresh and try again.",
      };
    }

    if (!currentEntity) {
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "Sign in to issue patron passes for this company.",
      };
    }

    const { data: houseRole, error: houseRoleError } = await supabase
      .from("house_roles")
      .select("id")
      .eq("house_id", house.id)
      .eq("entity_id", currentEntity.id)
      .maybeSingle();

    if (houseRoleError) {
      console.error("Failed to verify house role before issuing patron pass", houseRoleError);
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "We couldn’t verify your role at this house. Try again later.",
      };
    }

    let hasAccess = Boolean(houseRole);
    if (!hasAccess && house.guild_id) {
      const { data: guildRole, error: guildRoleError } = await supabase
        .from("guild_roles")
        .select("id")
        .eq("guild_id", house.guild_id)
        .eq("entity_id", currentEntity.id)
        .maybeSingle();

      if (guildRoleError) {
        console.error("Failed to verify guild role before issuing patron pass", guildRoleError);
        return {
          ...INITIAL_PATRON_PASS_STATE,
          status: "error",
          message: "We couldn’t verify your guild role just now. Try again later.",
        };
      }

      hasAccess = Boolean(guildRole);
    }

    if (!hasAccess) {
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "Only house or guild staff can issue patron passes.",
      };
    }

    const scheme = await ensureHousePassScheme({ supabase, house, housePassLabel: "Patron Pass" });

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
        console.error("Failed to resolve entity while issuing patron pass", error);
        return {
          ...INITIAL_PATRON_PASS_STATE,
          status: "error",
          message: "We couldn’t resolve that contact. Check it and try again.",
        };
      }
    }

    if (!entityId) {
      return {
        ...INITIAL_PATRON_PASS_STATE,
        status: "error",
        message: "Share an email address or phone number to look up the patron.",
      };
    }

    const cards = await loadCardsForEntity(entityId, { supabase });
    const higherCard = cards
      .filter((card) => card.scheme.id !== scheme.id && card.scheme.precedence < scheme.precedence)
      .sort((a, b) => a.scheme.precedence - b.scheme.precedence)[0] ?? null;

    if (higherCard && !forceIssue) {
      return {
        status: "needs-override",
        message: `Higher-precedence pass detected (${higherCard.scheme.name}). Issue a patron pass anyway?`,
        entityId,
        higherCard: {
          scope: higherCard.scheme.scope,
          name: higherCard.scheme.name,
          cardNo: higherCard.card_no,
        },
        issuedCard: null,
      } satisfies IssuePatronPassState;
    }

    if (forceIssue && !overrideReason) {
      return {
        status: "needs-override",
        message: "Add a reason before issuing a lower-precedence pass.",
        entityId,
        higherCard: higherCard
          ? {
              scope: higherCard.scheme.scope,
              name: higherCard.scheme.name,
              cardNo: higherCard.card_no,
            }
          : null,
        issuedCard: null,
      } satisfies IssuePatronPassState;
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
      console.warn("Failed to ensure loyalty profile while issuing patron pass", error);
    }

    revalidatePath(`/company/${slug}/patron-pass`);

    return {
      status: "success",
      message: `${scheme.name} ready. Card number ${issued.card_no}.`,
      entityId,
      higherCard: null,
      issuedCard: {
        cardNo: issued.card_no,
        incognitoDefault: issued.flags.incognito_default ?? false,
      },
    } satisfies IssuePatronPassState;
  } catch (error) {
    console.error("Failed to issue patron pass", error);
    return {
      ...INITIAL_PATRON_PASS_STATE,
      status: "error",
      message: "We couldn’t issue that pass right now. Try again later.",
    };
  }
}
