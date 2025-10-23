import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";
import { isJsonObject, type JsonObject } from "@/lib/types/taxonomy";

import type { LoyaltyScheme, LoyaltyScope } from "../loyalty/rules";
import { parseLoyaltyScheme } from "../loyalty/rules";

export type CardStatus = "active" | "suspended" | "revoked";
export type CardTokenKind = "qr" | "barcode" | "nfc";

export type CardFlags = {
  incognito_default?: boolean;
  [key: string]: unknown;
};

export type Card = {
  id: string;
  scheme_id: string;
  entity_id: string;
  card_no: string;
  status: CardStatus;
  issued_at: string;
  created_at: string;
  updated_at: string;
  flags: CardFlags;
};

export type CardWithScheme = Card & { scheme: LoyaltyScheme };

export type CardToken = {
  id: string;
  card_id: string;
  kind: CardTokenKind;
  token_hash: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type RotateCardTokenResult = {
  token: string;
  tokenId: string;
  expiresAt: string | null;
};

const CARD_STATUS_VALUES: CardStatus[] = ["active", "suspended", "revoked"];
const TOKEN_KIND_VALUES: CardTokenKind[] = ["qr", "barcode", "nfc"];

function resolveSupabaseClient(explicit?: SupabaseClient): SupabaseClient {
  if (explicit) return explicit;
  const client = getSupabase();
  if (!client) {
    throw new Error("Supabase client is not available");
  }
  return client;
}

function normalizeStatus(value: unknown): CardStatus {
  if (typeof value !== "string") {
    throw new Error("Card is missing status");
  }
  const lowered = value.toLowerCase();
  if (!CARD_STATUS_VALUES.includes(lowered as CardStatus)) {
    throw new Error(`Card has unsupported status ${value}`);
  }
  return lowered as CardStatus;
}

function normalizeFlags(value: unknown): CardFlags {
  if (!isJsonObject(value)) {
    return {};
  }
  const flags: CardFlags = { ...value };
  if (typeof flags.incognito_default !== "boolean") {
    delete flags.incognito_default;
  }
  return flags;
}

export function parseCard(value: unknown): Card {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid card payload");
  }

  const record = value as Record<string, unknown>;
  const { id, scheme_id, entity_id, card_no, status, issued_at, created_at, updated_at, flags } = record;

  if (typeof id !== "string") throw new Error("Card payload missing id");
  if (typeof scheme_id !== "string") throw new Error("Card payload missing scheme_id");
  if (typeof entity_id !== "string") throw new Error("Card payload missing entity_id");
  if (typeof card_no !== "string") throw new Error("Card payload missing card_no");
  if (typeof issued_at !== "string") throw new Error("Card payload missing issued_at");
  if (typeof created_at !== "string") throw new Error("Card payload missing created_at");
  if (typeof updated_at !== "string") throw new Error("Card payload missing updated_at");

  return {
    id,
    scheme_id,
    entity_id,
    card_no,
    status: normalizeStatus(status),
    issued_at,
    created_at,
    updated_at,
    flags: normalizeFlags(flags),
  } satisfies Card;
}

export function parseCardWithScheme(value: unknown): CardWithScheme {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid card payload");
  }

  const record = value as Record<string, unknown>;
  const schemeValue = record.scheme ?? record.loyalty_schemes;
  const card = parseCard(record);

  if (!schemeValue) {
    throw new Error("Card payload missing scheme relation");
  }

  const scheme = parseLoyaltyScheme(schemeValue);
  return { ...card, scheme } satisfies CardWithScheme;
}

export function parseCardToken(value: unknown): CardToken {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid card token payload");
  }

  const record = value as Record<string, unknown>;
  const { id, card_id, kind, token_hash, active, expires_at, created_at } = record;

  if (typeof id !== "string") throw new Error("Card token missing id");
  if (typeof card_id !== "string") throw new Error("Card token missing card_id");
  if (typeof token_hash !== "string") throw new Error("Card token missing token_hash");
  if (typeof created_at !== "string") throw new Error("Card token missing created_at");
  if (typeof active !== "boolean") throw new Error("Card token missing active flag");
  if (typeof kind !== "string" || !TOKEN_KIND_VALUES.includes(kind as CardTokenKind)) {
    throw new Error(`Unsupported card token kind: ${kind}`);
  }

  return {
    id,
    card_id,
    kind: kind as CardTokenKind,
    token_hash,
    active,
    expires_at: typeof expires_at === "string" ? expires_at : null,
    created_at,
  } satisfies CardToken;
}

const CARD_PREFIX_BY_SCOPE: Record<LoyaltyScope, string> = {
  ALLIANCE: "MP",
  GUILD: "GC",
  HOUSE: "PP",
};

function randomAlphanumeric(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = bytes[i] % alphabet.length;
    result += alphabet[index];
  }
  return result;
}

function generateCardNumber(scope: LoyaltyScope): string {
  const prefix = CARD_PREFIX_BY_SCOPE[scope] ?? "ID";
  return `${prefix}-${randomAlphanumeric(8)}`;
}

export type IssueCardOptions = {
  scheme: LoyaltyScheme;
  entityId: string;
  cardNo?: string;
  status?: CardStatus;
  incognitoDefault?: boolean;
  supabase?: SupabaseClient;
};

const UNIQUE_VIOLATION = "23505";

function buildFlagPayload(card: Card, updates: Partial<CardFlags>): JsonObject {
  return { ...card.flags, ...updates };
}

export async function loadCardsForEntity(
  entityId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<CardWithScheme[]> {
  const supabase = resolveSupabaseClient(options.supabase);
  const { data, error } = await supabase
    .from("cards")
    .select("*, scheme:loyalty_schemes(*)")
    .eq("entity_id", entityId)
    .order("issued_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load cards for entity ${entityId}: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((entry) => parseCardWithScheme(entry));
}

export async function findCardForScheme(
  entityId: string,
  schemeId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<CardWithScheme | null> {
  const supabase = resolveSupabaseClient(options.supabase);
  const { data, error } = await supabase
    .from("cards")
    .select("*, scheme:loyalty_schemes(*)")
    .eq("entity_id", entityId)
    .eq("scheme_id", schemeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load card for scheme ${schemeId}: ${error.message}`);
  }

  return data ? parseCardWithScheme(data) : null;
}

export async function loadCardById(
  cardId: string,
  options: { supabase?: SupabaseClient } = {},
): Promise<CardWithScheme | null> {
  const supabase = resolveSupabaseClient(options.supabase);
  const { data, error } = await supabase
    .from("cards")
    .select("*, scheme:loyalty_schemes(*)")
    .eq("id", cardId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load card ${cardId}: ${error.message}`);
  }

  return data ? parseCardWithScheme(data) : null;
}

export async function issueCard(options: IssueCardOptions): Promise<CardWithScheme> {
  const supabase = resolveSupabaseClient(options.supabase);
  const existing = await findCardForScheme(options.entityId, options.scheme.id, { supabase });
  if (existing) {
    return existing;
  }

  let candidateCardNo = options.cardNo ?? generateCardNumber(options.scheme.scope);
  const flags: CardFlags = {};
  if (typeof options.incognitoDefault === "boolean") {
    flags.incognito_default = options.incognitoDefault;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const payload = {
      scheme_id: options.scheme.id,
      entity_id: options.entityId,
      card_no: candidateCardNo,
      status: options.status ?? "active",
      flags,
    };

    const { data, error } = await supabase
      .from("cards")
      .insert(payload)
      .select("*, scheme:loyalty_schemes(*)")
      .single();

    if (!error && data) {
      return parseCardWithScheme(data);
    }

    if (error?.code === UNIQUE_VIOLATION) {
      candidateCardNo = generateCardNumber(options.scheme.scope);
      continue;
    }

    if (error) {
      throw new Error(`Failed to issue card: ${error.message}`);
    }
  }

  throw new Error("Failed to issue card after multiple attempts");
}

export async function updateCardFlags(
  cardId: string,
  flags: Partial<CardFlags>,
  options: { supabase?: SupabaseClient } = {},
): Promise<CardWithScheme> {
  const supabase = resolveSupabaseClient(options.supabase);
  const existing = await loadCardById(cardId, { supabase });
  if (!existing) {
    throw new Error(`Card ${cardId} was not found`);
  }

  const payload = {
    flags: buildFlagPayload(existing, flags),
  } satisfies { flags: JsonObject };

  const { data, error } = await supabase
    .from("cards")
    .update(payload)
    .eq("id", cardId)
    .select("*, scheme:loyalty_schemes(*)")
    .single();

  if (error) {
    throw new Error(`Failed to update card flags: ${error.message}`);
  }

  return parseCardWithScheme(data);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateTokenString(): string {
  return randomBytes(16).toString("base64url");
}

export async function rotateCardToken(
  cardId: string,
  kind: CardTokenKind,
  options: { supabase?: SupabaseClient; expiresAt?: Date | null } = {},
): Promise<RotateCardTokenResult> {
  const supabase = resolveSupabaseClient(options.supabase);

  const { error: deactivateError } = await supabase
    .from("card_tokens")
    .update({ active: false })
    .eq("card_id", cardId)
    .eq("kind", kind)
    .eq("active", true);

  if (deactivateError) {
    throw new Error(`Failed to deactivate previous tokens: ${deactivateError.message}`);
  }

  const token = generateTokenString();
  const tokenHash = hashToken(token);

  const payload = {
    card_id: cardId,
    kind,
    token_hash: tokenHash,
    active: true,
    expires_at: options.expiresAt ?? null,
  };

  const { data, error } = await supabase.from("card_tokens").insert(payload).select("*").single();

  if (error) {
    throw new Error(`Failed to issue new card token: ${error.message}`);
  }

  const parsed = parseCardToken(data);
  return {
    token,
    tokenId: parsed.id,
    expiresAt: parsed.expires_at,
  } satisfies RotateCardTokenResult;
}
