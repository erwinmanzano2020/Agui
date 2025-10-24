import { createHash } from "node:crypto";

import { getSupabase } from "@/lib/supabase";
import { LoyaltyScheme, parseLoyaltyScheme, sortByPrecedence } from "@/lib/loyalty/rules";

type Scope = "GUILD" | "HOUSE" | "ALLIANCE";

type OverrideOptions = {
  useHigher?: boolean;
  issueLowerAnyway?: boolean;
  reason?: string;
  liftIncognito?: boolean;
};

export type ResolutionInput = {
  rawToken: string;
  context?: { scope?: "GUILD" | "HOUSE"; guildId?: string; companyId?: string };
  actorEntityId?: string;
  override?: OverrideOptions;
};

export type ResolutionResult = {
  ok: boolean;
  hud: {
    scope: Scope | "UNKNOWN";
    incognito: boolean;
    entityId?: string;
    cardId?: string;
    schemeName?: string;
    hints?: string[];
    hasHigherCard?: boolean;
    higherLabel?: string | null;
  };
  needsDecision?: boolean;
  error?: string;
  tokenId?: string;
  resolvedCardId?: string;
};

function hash(raw: string) {
  return createHash("sha256").update(raw).digest("base64url");
}

function readIncognitoDefault(flags: unknown): boolean {
  if (typeof flags !== "object" || flags === null || Array.isArray(flags)) {
    return false;
  }

  const value = (flags as Record<string, unknown>).incognito_default;
  return typeof value === "boolean" ? value : false;
}

type EntityCardRow = {
  id: string;
  scheme_id: string;
  status: string | null;
  flags: unknown;
};

export async function resolveScan(input: ResolutionInput): Promise<ResolutionResult> {
  const db = getSupabase();
  if (!db) {
    return { ok: false, hud: { scope: "UNKNOWN", incognito: false }, error: "DB unavailable" };
  }

  const h = hash(input.rawToken);

  const { data: tok } = await db
    .from("card_tokens")
    .select("id, card_id, active")
    .eq("token_hash", h)
    .eq("active", true)
    .maybeSingle();

  if (!tok?.card_id) {
    return { ok: false, hud: { scope: "UNKNOWN", incognito: false }, error: "Token not found" };
  }

  const { data: card } = await db
    .from("cards")
    .select("id, scheme_id, entity_id, flags")
    .eq("id", tok.card_id)
    .maybeSingle();

  if (!card) {
    return { ok: false, hud: { scope: "UNKNOWN", incognito: false }, error: "Card missing" };
  }

  const { data: scheme } = await db
    .from("loyalty_schemes")
    .select("*")
    .eq("id", card.scheme_id)
    .maybeSingle();

  if (!scheme) {
    return { ok: false, hud: { scope: "UNKNOWN", incognito: false }, error: "Scheme missing" };
  }

  const currentScheme = parseLoyaltyScheme(scheme);
  const baseIncognito = readIncognitoDefault(card.flags);

  const { data: entityCards } = await db
    .from("cards")
    .select("id, scheme_id, status, flags")
    .eq("entity_id", card.entity_id);

  let hasHigherCard = false;
  let higherLabel: string | null = null;
  let higherCardId: string | null = null;
  let higherScheme: LoyaltyScheme | null = null;
  let higherIncognitoDefault = false;

  const normalizedCards = (entityCards ?? [])
    .filter((entry): entry is EntityCardRow =>
      typeof entry?.id === "string" &&
      typeof entry?.scheme_id === "string" &&
      entry.scheme_id.length > 0
    )
    .filter((entry) => entry.status === "active");

  if (normalizedCards.length > 0) {
    const ids = normalizedCards.map((item) => item.scheme_id);

    if (ids.length > 0) {
      const { data: rows } = await db.from("loyalty_schemes").select("*").in("id", ids);

      if (rows?.length) {
        const normalized: LoyaltyScheme[] = [];
        for (const row of rows) {
          try {
            normalized.push(parseLoyaltyScheme(row));
          } catch {
            // Ignore invalid rows; they cannot influence precedence decisions.
          }
        }

        if (normalized.length) {
          const sorted = sortByPrecedence(normalized);
          const top = sorted[0];

          if (
            top &&
            top.id !== currentScheme.id &&
            top.precedence < currentScheme.precedence &&
            top.is_active
          ) {
            hasHigherCard = true;
            higherLabel = top.name;
            higherScheme = top;
            const higherCard = normalizedCards.find((entry) => entry.scheme_id === top.id) ?? null;
            if (higherCard) {
              higherCardId = higherCard.id;
              higherIncognitoDefault = readIncognitoDefault(higherCard.flags);
            }
          }
        }
      }
    }
  }

  let activeCardId = card.id;
  let activeScheme: LoyaltyScheme = currentScheme;
  let activeIncognitoDefault = baseIncognito;

  if (input.override?.useHigher) {
    if (!hasHigherCard || !higherScheme || !higherCardId) {
      return {
        ok: false,
        hud: { scope: "UNKNOWN", incognito: false },
        error: "Higher-precedence card unavailable",
      };
    }

    activeCardId = higherCardId;
    activeScheme = higherScheme;
    activeIncognitoDefault = higherIncognitoDefault;
  }

  const incognito = activeIncognitoDefault;
  const scope = (activeScheme.scope as Scope | undefined) ?? "UNKNOWN";
  const shouldReveal = !incognito || Boolean(input?.override?.liftIncognito);
  const resolvedCardId = activeCardId;
  const resolvedEntityId = card.entity_id;

  const hud: ResolutionResult["hud"] = {
    scope,
    incognito,
    entityId: shouldReveal ? resolvedEntityId : undefined,
    cardId: shouldReveal ? resolvedCardId : undefined,
    schemeName: activeScheme.name,
    hints: incognito && !shouldReveal ? ["Scope-limited profile"] : [],
    hasHigherCard: hasHigherCard && !input?.override?.useHigher,
    higherLabel: hasHigherCard && !input?.override?.useHigher ? higherLabel : null,
  };

  const needsDecision = Boolean(
    hasHigherCard && !input?.override?.useHigher && !input?.override?.issueLowerAnyway,
  );

  return { ok: true, hud, needsDecision, tokenId: tok.id, resolvedCardId };
}
