import { getSupabase } from "@/lib/supabase";
import { sortByPrecedence } from "@/lib/loyalty/rules";

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
};

function hash(raw: string) {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(raw).digest("base64url");
}

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

  const incognito = Boolean(card.flags?.incognito_default);

  const { data: entitySchemes } = await db
    .from("cards")
    .select("id, scheme_id")
    .eq("entity_id", card.entity_id);

  let hasHigherCard = false;
  let higherLabel: string | null = null;

  if (entitySchemes && entitySchemes.length) {
    const ids = entitySchemes.map((x) => x.scheme_id);
    const { data: rows } = await db
      .from("loyalty_schemes")
      .select("id, name, precedence, is_active")
      .in("id", ids);

    if (rows?.length) {
      const sorted = sortByPrecedence(rows as any);
      const top = sorted[0];

      if (top && top.id !== scheme.id && top.precedence < scheme.precedence && top.is_active) {
        hasHigherCard = true;
        higherLabel = top.name;
      }
    }
  }

  const scope = (scheme.scope as Scope | undefined) ?? "UNKNOWN";

  const hud: ResolutionResult["hud"] = {
    scope,
    incognito,
    entityId: incognito && !input?.override?.liftIncognito ? undefined : card.entity_id,
    cardId: incognito && !input?.override?.liftIncognito ? undefined : card.id,
    schemeName: scheme.name,
    hints: incognito && !input?.override?.liftIncognito ? ["Scope-limited profile"] : [],
    hasHigherCard,
    higherLabel: hasHigherCard ? higherLabel : null,
  };

  const needsDecision = Boolean(
    hasHigherCard && !input?.override?.useHigher && !input?.override?.issueLowerAnyway,
  );

  return { ok: true, hud, needsDecision };
}
