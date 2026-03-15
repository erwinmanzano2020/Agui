import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";
import { parseEntity, type Entity } from "@/lib/types/taxonomy";

import {
  hashCardToken,
  loadCardsForEntity,
  parseCardToken,
  parseCardWithScheme,
  type CardStatus,
  type CardToken,
  type CardTokenKind,
  type CardWithScheme,
} from "./cards";
import type { LoyaltyScope } from "../loyalty/rules";

export type ScanContext = {
  houseId?: string | null;
  guildId?: string | null;
};

export type LinkedCardSummary = {
  cardId: string;
  cardNo: string;
  schemeId: string;
  schemeName: string;
  scope: LoyaltyScope;
  precedence: number;
  incognitoDefault: boolean;
};

export type LoyaltyAccountSnapshot = {
  accountNo: string;
  points: number;
  tier: string | null;
};

export type ScanResolution = {
  token: {
    id: string;
    kind: CardTokenKind;
    active: boolean;
    expiresAt: string | null;
  };
  card: {
    id: string;
    cardNo: string;
    status: CardStatus;
    scheme: {
      id: string;
      name: string;
      scope: LoyaltyScope;
      precedence: number;
      allowIncognito: boolean;
    };
    incognitoDefault: boolean;
  };
  entity: {
    id: string;
    displayName: string;
  };
  incognitoActive: boolean;
  incognitoDefault: boolean;
  higherCard: LinkedCardSummary | null;
  linkedCards: LinkedCardSummary[];
  loyaltyAccount: LoyaltyAccountSnapshot | null;
  guildRoles: string[];
  houseRoles: string[];
};

export type RecordScanEventInput = ScanContext & {
  supabase?: SupabaseClient;
  tokenId: string;
  cardId: string;
  actorId?: string | null;
  liftedIncognito: boolean;
  reason: string;
};

function resolveSupabaseClient(explicit?: SupabaseClient): SupabaseClient {
  if (explicit) return explicit;
  const client = getSupabase();
  if (!client) {
    throw new Error("Supabase client is not available");
  }
  return client;
}

type TokenRow = {
  id: string;
  card_id: string;
  kind: string;
  token_hash: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  card: Record<string, unknown> | null;
};

type EntityRow = Record<string, unknown> | null;

type CardRow = Record<string, unknown> & { entity?: EntityRow };

function assertCardRow(cardRow: Record<string, unknown> | null): asserts cardRow is CardRow {
  if (!cardRow) {
    throw new Error("Scan token is missing an associated card");
  }
}

function parseTokenRow(row: TokenRow): {
  token: CardToken;
  card: CardWithScheme;
  entity: Entity;
} {
  const token = parseCardToken(row);
  assertCardRow(row.card);
  const card = parseCardWithScheme(row.card);
  const entityPayload = (row.card as CardRow).entity ?? null;
  if (!entityPayload) {
    throw new Error("Card payload is missing entity information");
  }
  const entity = parseEntity(entityPayload);
  return { token, card, entity };
}

async function fetchTokenByHash(
  supabase: SupabaseClient,
  hash: string,
): Promise<{ token: CardToken; card: CardWithScheme; entity: Entity }> {
  const { data, error } = await supabase
    .from("card_tokens")
    .select("*, card:cards(*, scheme:loyalty_schemes(*), entity:entities(*))")
    .eq("token_hash", hash)
    .eq("active", true)
    .maybeSingle<TokenRow>();

  if (error) {
    throw new Error(`Failed to resolve card token: ${error.message}`);
  }

  if (!data) {
    throw new Error("No active card token matched that scan");
  }

  return parseTokenRow(data);
}

async function fetchTokenById(
  supabase: SupabaseClient,
  tokenId: string,
): Promise<{ token: CardToken; card: CardWithScheme; entity: Entity }> {
  const { data, error } = await supabase
    .from("card_tokens")
    .select("*, card:cards(*, scheme:loyalty_schemes(*), entity:entities(*))")
    .eq("id", tokenId)
    .eq("active", true)
    .maybeSingle<TokenRow>();

  if (error) {
    throw new Error(`Failed to reload card token: ${error.message}`);
  }

  if (!data) {
    throw new Error("We couldn’t load that scan anymore. Ask to rescan the pass.");
  }

  return parseTokenRow(data);
}

function toLinkedSummary(card: CardWithScheme): LinkedCardSummary {
  return {
    cardId: card.id,
    cardNo: card.card_no,
    schemeId: card.scheme.id,
    schemeName: card.scheme.name,
    scope: card.scheme.scope,
    precedence: card.scheme.precedence,
    incognitoDefault: card.flags.incognito_default ?? false,
  } satisfies LinkedCardSummary;
}

function ensureTokenIsFresh(token: CardToken) {
  if (!token.active) {
    throw new Error("That token is no longer active. Rotate the QR code and try again.");
  }

  if (token.expires_at) {
    const expiresAt = new Date(token.expires_at);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error("The token has an invalid expiration timestamp.");
    }
    if (expiresAt.getTime() < Date.now()) {
      throw new Error("That token has expired. Ask the patron to rotate their pass.");
    }
  }
}

async function fetchLoyaltyAccount(
  supabase: SupabaseClient,
  schemeId: string,
  entityId: string,
): Promise<LoyaltyAccountSnapshot | null> {
  const { data, error } = await supabase
    .from("loyalty_profiles")
    .select("account_no, points, tier")
    .eq("scheme_id", schemeId)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load loyalty profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  if (typeof data.account_no !== "string") {
    return null;
  }

  return {
    accountNo: data.account_no,
    points: typeof data.points === "number" ? data.points : 0,
    tier: typeof data.tier === "string" ? data.tier : null,
  } satisfies LoyaltyAccountSnapshot;
}

async function fetchHouseRoles(
  supabase: SupabaseClient,
  entityId: string,
  houseId: string | null | undefined,
): Promise<string[]> {
  if (!houseId) return [];
  const { data, error } = await supabase
    .from("house_roles")
    .select("role")
    .eq("house_id", houseId)
    .eq("entity_id", entityId);

  if (error) {
    throw new Error(`Failed to load house roles: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry) => (typeof entry.role === "string" ? entry.role : null))
    .filter((role): role is string => !!role);
}

async function fetchGuildRoles(
  supabase: SupabaseClient,
  entityId: string,
  guildId: string | null | undefined,
): Promise<string[]> {
  if (!guildId) return [];
  const { data, error } = await supabase
    .from("guild_roles")
    .select("role")
    .eq("guild_id", guildId)
    .eq("entity_id", entityId);

  if (error) {
    throw new Error(`Failed to load guild roles: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry) => (typeof entry.role === "string" ? entry.role : null))
    .filter((role): role is string => !!role);
}

function buildResolution(
  token: CardToken,
  card: CardWithScheme,
  entity: Entity,
  linkedCards: CardWithScheme[],
  loyaltyAccount: LoyaltyAccountSnapshot | null,
  roles: { guildRoles: string[]; houseRoles: string[] },
): ScanResolution {
  const incognitoDefault = card.flags.incognito_default ?? false;
  const higherCard = linkedCards
    .filter(
      (linked) =>
        linked.status === "active" &&
        linked.scheme.precedence < card.scheme.precedence,
    )
    .sort((a, b) => a.scheme.precedence - b.scheme.precedence)[0] ?? null;

  return {
    token: {
      id: token.id,
      kind: token.kind,
      active: token.active,
      expiresAt: token.expires_at,
    },
    card: {
      id: card.id,
      cardNo: card.card_no,
      status: card.status,
      scheme: {
        id: card.scheme.id,
        name: card.scheme.name,
        scope: card.scheme.scope,
        precedence: card.scheme.precedence,
        allowIncognito: card.scheme.allow_incognito,
      },
      incognitoDefault,
    },
    entity: {
      id: entity.id,
      displayName: entity.display_name,
    },
    incognitoActive: incognitoDefault,
    incognitoDefault,
    higherCard: higherCard ? toLinkedSummary(higherCard) : null,
    linkedCards: linkedCards.filter((linked) => linked.id !== card.id).map(toLinkedSummary),
    loyaltyAccount,
    guildRoles: roles.guildRoles,
    houseRoles: roles.houseRoles,
  } satisfies ScanResolution;
}

async function resolveScan(
  fetcher: () => Promise<{ token: CardToken; card: CardWithScheme; entity: Entity }>,
  options: { supabase: SupabaseClient } & ScanContext,
): Promise<ScanResolution> {
  const { token, card, entity } = await fetcher();
  ensureTokenIsFresh(token);

  if (card.status !== "active") {
    throw new Error("That card is not active anymore.");
  }

  const [linkedCards, loyaltyAccount, guildRoles, houseRoles] = await Promise.all([
    loadCardsForEntity(entity.id, { supabase: options.supabase }),
    fetchLoyaltyAccount(options.supabase, card.scheme.id, entity.id).catch((error) => {
      console.warn("Failed to fetch loyalty account while resolving scan", error);
      return null;
    }),
    fetchGuildRoles(options.supabase, entity.id, options.guildId).catch((error) => {
      console.warn("Failed to fetch guild roles while resolving scan", error);
      return [] as string[];
    }),
    fetchHouseRoles(options.supabase, entity.id, options.houseId).catch((error) => {
      console.warn("Failed to fetch house roles while resolving scan", error);
      return [] as string[];
    }),
  ]);

  const roles = {
    guildRoles,
    houseRoles,
  };

  return buildResolution(token, card, entity, linkedCards, loyaltyAccount, roles);
}

export async function resolveScanByToken(
  token: string,
  options: ScanContext & { supabase?: SupabaseClient },
): Promise<ScanResolution> {
  const supabase = resolveSupabaseClient(options.supabase);
  const hash = hashCardToken(token);
  return resolveScan(() => fetchTokenByHash(supabase, hash), { supabase, ...options });
}

export async function resolveScanByTokenId(
  tokenId: string,
  options: ScanContext & { supabase?: SupabaseClient },
): Promise<ScanResolution> {
  const supabase = resolveSupabaseClient(options.supabase);
  return resolveScan(() => fetchTokenById(supabase, tokenId), { supabase, ...options });
}

export async function recordScanEvent(input: RecordScanEventInput): Promise<void> {
  const supabase = resolveSupabaseClient(input.supabase);
  const payload = {
    token_id: input.tokenId,
    resolved_card_id: input.cardId,
    house_id: input.houseId ?? null,
    guild_id: input.guildId ?? null,
    actor_id: input.actorId ?? null,
    lifted_incognito: input.liftedIncognito,
    reason: input.reason,
  };

  const { error } = await supabase.from("scan_events").insert(payload);
  if (error) {
    throw new Error(`Failed to record scan event: ${error.message}`);
  }
}
