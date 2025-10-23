import { getSupabase } from "../supabase";

export type LoyaltyScope = "ALLIANCE" | "GUILD" | "HOUSE";

export type LoyaltyScheme = {
  id: string;
  scope: LoyaltyScope;
  name: string;
  precedence: number;
  is_active: boolean;
  allow_incognito: boolean;
  design: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LoyaltyProfile = {
  id: string;
  scheme_id: string;
  entity_id: string;
  account_no: string;
  points: number;
  tier: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateLoyaltySchemeInput = {
  scope: LoyaltyScope;
  name: string;
  precedence?: number;
  is_active?: boolean;
  allow_incognito?: boolean;
  design?: Record<string, unknown>;
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
    created_at,
    updated_at,
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
  if (typeof created_at !== "string" || typeof updated_at !== "string") {
    throw new Error("Loyalty scheme timestamps are invalid");
  }

  return {
    id,
    scope,
    name,
    precedence,
    is_active,
    allow_incognito,
    design: isPlainObject(design) ? design : {},
    created_at,
    updated_at,
  } satisfies LoyaltyScheme;
}

export function parseLoyaltyProfile(value: unknown): LoyaltyProfile {
  if (!isPlainObject(value)) {
    throw new Error("Invalid loyalty profile payload");
  }

  const { id, scheme_id, entity_id, account_no, points, tier, created_at, updated_at } = value;

  if (typeof id !== "string") {
    throw new Error("Loyalty profile is missing id");
  }
  if (typeof scheme_id !== "string") {
    throw new Error("Loyalty profile is missing scheme_id");
  }
  if (typeof entity_id !== "string") {
    throw new Error("Loyalty profile is missing entity_id");
  }
  if (typeof account_no !== "string") {
    throw new Error("Loyalty profile is missing account_no");
  }
  if (typeof points !== "number") {
    throw new Error("Loyalty profile is missing points");
  }
  if (typeof created_at !== "string" || typeof updated_at !== "string") {
    throw new Error("Loyalty profile timestamps are invalid");
  }

  return {
    id,
    scheme_id,
    entity_id,
    account_no,
    points,
    tier: typeof tier === "string" ? tier : null,
    created_at,
    updated_at,
  } satisfies LoyaltyProfile;
}

/**
 * Order loyalty schemes deterministically by precedence and scope.
 * Lowest precedence value wins. Ties fall back to scope, name, then id.
 */
export function resolvePrecedence(schemes: LoyaltyScheme[]): LoyaltyScheme[] {
  return [...schemes].sort((a, b) => {
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
  });
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
