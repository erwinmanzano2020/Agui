import { getSupabase } from "@/lib/supabase";

export type LoyaltyScope = "ALLIANCE" | "GUILD" | "HOUSE";

export type LoyaltyScheme = {
  id: string;
  scope: LoyaltyScope;
  name: string;
  precedence: number;
  is_active: boolean;
  allow_incognito: boolean;
  design: Record<string, unknown>;
  meta: Record<string, unknown>;
  created_at: string;
};

export type LoyaltyProfile = {
  id: string;
  scheme_id: string;
  entity_id: string;
  account_no: string | null;
  points: number;
  tier: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type CreateLoyaltySchemeInput = {
  scope: LoyaltyScope;
  name: string;
  precedence?: number;
  is_active?: boolean;
  allow_incognito?: boolean;
  design?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export type EnrollLoyaltyProfileInput = {
  schemeId: string;
  entityId: string;
  accountNo: string;
  points?: number;
  tier?: string | null;
};

const SCOPE_RANK: Record<LoyaltyScope, number> = {
  ALLIANCE: 0,
  GUILD: 1,
  HOUSE: 2,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLoyaltyScheme(value: unknown): LoyaltyScheme {
  if (!isPlainObject(value)) {
    throw new Error("Invalid loyalty scheme payload");
  }

  const {
    id,
    scope,
    name,
    precedence,
    is_active,
    allow_incognito,
    design,
    meta,
    created_at,
  } = value;

  if (typeof id !== "string") {
    throw new Error("Loyalty scheme is missing id");
  }
  if (scope !== "ALLIANCE" && scope !== "GUILD" && scope !== "HOUSE") {
    throw new Error("Loyalty scheme has invalid scope");
  }
  if (typeof name !== "string") {
    throw new Error("Loyalty scheme is missing name");
  }
  if (typeof precedence !== "number") {
    throw new Error("Loyalty scheme is missing precedence");
  }
  if (typeof is_active !== "boolean") {
    throw new Error("Loyalty scheme is missing is_active flag");
  }
  if (typeof allow_incognito !== "boolean") {
    throw new Error("Loyalty scheme is missing allow_incognito flag");
  }
  if (typeof created_at !== "string") {
    throw new Error("Loyalty scheme timestamp is invalid");
  }

  return {
    id,
    scope,
    name,
    precedence,
    is_active,
    allow_incognito,
    design: isPlainObject(design) ? design : {},
    meta: isPlainObject(meta) ? meta : {},
    created_at,
  } satisfies LoyaltyScheme;
}

export function parseLoyaltyProfile(value: unknown): LoyaltyProfile {
  if (!isPlainObject(value)) {
    throw new Error("Invalid loyalty profile payload");
  }

  const { id, scheme_id, entity_id, account_no, points, tier, meta, created_at } = value;

  if (typeof id !== "string") {
    throw new Error("Loyalty profile is missing id");
  }
  if (typeof scheme_id !== "string") {
    throw new Error("Loyalty profile is missing scheme_id");
  }
  if (typeof entity_id !== "string") {
    throw new Error("Loyalty profile is missing entity_id");
  }
  if (typeof points !== "number") {
    throw new Error("Loyalty profile is missing points");
  }
  if (typeof created_at !== "string") {
    throw new Error("Loyalty profile timestamp is invalid");
  }

  return {
    id,
    scheme_id,
    entity_id,
    account_no: typeof account_no === "string" ? account_no : null,
    points,
    tier: typeof tier === "string" ? tier : null,
    meta: isPlainObject(meta) ? meta : {},
    created_at,
  } satisfies LoyaltyProfile;
}

function compareSchemes(a: LoyaltyScheme, b: LoyaltyScheme): number {
  if (a.is_active !== b.is_active) {
    return a.is_active ? -1 : 1;
  }

  if (a.precedence !== b.precedence) {
    return a.precedence - b.precedence;
  }

  const scopeRankDelta = SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope];
  if (scopeRankDelta !== 0) {
    return scopeRankDelta;
  }

  const nameComparison = a.name.localeCompare(b.name);
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return a.id.localeCompare(b.id);
}

/** Sort ascending by precedence, active first */
export function sortByPrecedence(schemes: LoyaltyScheme[]): LoyaltyScheme[] {
  return [...schemes].sort(compareSchemes);
}

/**
 * Order loyalty schemes deterministically by precedence and scope.
 * Lowest precedence value wins. Ties fall back to scope, name, then id.
 */
export function resolvePrecedence(schemes: LoyaltyScheme[]): LoyaltyScheme[] {
  return sortByPrecedence(schemes);
}

/** Given a scope filter, return active schemes ordered by precedence */
export async function listSchemes(scope?: LoyaltyScope): Promise<LoyaltyScheme[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const query = supabase.from("loyalty_schemes").select("*").eq("is_active", true);
  const { data, error } = scope ? await query.eq("scope", scope) : await query;
  if (error || !data) {
    return [];
  }

  return sortByPrecedence((data as unknown[]).map((row) => parseLoyaltyScheme(row)));
}

/** Enroll (idempotent) an entity into a scheme; returns profile row */
export async function enrollEntity(
  schemeId: string,
  entityId: string,
  accountNo?: string,
): Promise<LoyaltyProfile> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client is not available");
  }

  const payload: Record<string, unknown> = {
    scheme_id: schemeId,
    entity_id: entityId,
  };
  if (typeof accountNo !== "undefined") {
    payload.account_no = accountNo;
  }

  const { data, error } = await supabase
    .from("loyalty_profiles")
    .upsert(payload, { onConflict: "scheme_id,entity_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return parseLoyaltyProfile(data);
}

/** Get (or create) a per-scope scheme by name; helpful for tests/dev */
export async function ensureScheme(
  scope: LoyaltyScope,
  name: string,
  precedence: number,
): Promise<LoyaltyScheme> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client is not available");
  }

  const { data, error } = await supabase
    .from("loyalty_schemes")
    .select("*")
    .eq("scope", scope)
    .eq("name", name)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return parseLoyaltyScheme(data);
  }

  const { data: created, error: insertError } = await supabase
    .from("loyalty_schemes")
    .insert({ scope, name, precedence, is_active: true, allow_incognito: true })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return parseLoyaltyScheme(created);
}

/** Create a new loyalty scheme scoped to an alliance, guild, or house. */
export async function createLoyaltyScheme(
  input: CreateLoyaltySchemeInput,
): Promise<LoyaltyScheme> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client is not available");
  }

  const payload = {
    scope: input.scope,
    name: input.name,
    precedence: input.precedence ?? 0,
    is_active: input.is_active ?? true,
    allow_incognito: input.allow_incognito ?? false,
    design: input.design ?? {},
    meta: input.meta ?? {},
  };

  const { data, error } = await supabase
    .from("loyalty_schemes")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create loyalty scheme: ${error.message}`);
  }

  return parseLoyaltyScheme(data);
}

/** Enroll an entity into a loyalty scheme and return the resulting profile. */
export async function enrollLoyaltyProfile(
  input: EnrollLoyaltyProfileInput,
): Promise<LoyaltyProfile> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client is not available");
  }

  const payload = {
    scheme_id: input.schemeId,
    entity_id: input.entityId,
    account_no: input.accountNo,
    points: input.points ?? 0,
    tier: input.tier ?? null,
  };

  const { data, error } = await supabase
    .from("loyalty_profiles")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to enroll loyalty profile: ${error.message}`);
  }

  return parseLoyaltyProfile(data);
}

const UNIQUE_VIOLATION = "23505";

export type EnsureLoyaltyProfileInput = Omit<EnrollLoyaltyProfileInput, "points" | "tier"> & {
  points?: number;
  tier?: string | null;
};

/** Ensure an entity has a loyalty profile for the given scheme. */
export async function ensureLoyaltyProfile(
  input: EnsureLoyaltyProfileInput,
): Promise<LoyaltyProfile> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client is not available");
  }

  const payload = {
    scheme_id: input.schemeId,
    entity_id: input.entityId,
    account_no: input.accountNo,
    points: input.points ?? 0,
    tier: input.tier ?? null,
  };

  const { data, error } = await supabase
    .from("loyalty_profiles")
    .insert(payload)
    .select("*")
    .single();

  if (!error && data) {
    return parseLoyaltyProfile(data);
  }

  if (error && error.code === UNIQUE_VIOLATION) {
    const { data: existing, error: lookupError } = await supabase
      .from("loyalty_profiles")
      .select("*")
      .eq("scheme_id", input.schemeId)
      .eq("entity_id", input.entityId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to resolve existing loyalty profile: ${lookupError.message}`);
    }

    if (existing) {
      return parseLoyaltyProfile(existing);
    }
  }

  if (error) {
    throw new Error(`Failed to ensure loyalty profile: ${error.message}`);
  }

  throw new Error("Failed to ensure loyalty profile: Unknown error");
}
