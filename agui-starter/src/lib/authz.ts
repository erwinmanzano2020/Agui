import type { SupabaseClient, User } from "@supabase/supabase-js";

export type RoleScope = "PLATFORM" | "GUILD" | "HOUSE";

export type RoleAssignments = Record<RoleScope, string[]>;

function cloneEmptyRoles(): RoleAssignments {
  return {
    PLATFORM: [],
    GUILD: [],
    HOUSE: [],
  } satisfies RoleAssignments;
}

function normalizeEmail(email?: string | null): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(phone?: string | null): string | null {
  if (typeof phone !== "string") return null;
  const digits = phone.trim().replace(/[^\d+]/g, "");
  if (!digits) return null;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    console.warn("Failed to load Supabase user", error);
    return null;
  }

  return user ?? null;
}

async function lookupEntityIdByIdentifier(
  client: SupabaseClient,
  identifierTypes: string[],
  rawValue: string | null,
  normalize: ((value: string | null) => string | null) | null = null,
  context: string,
): Promise<string | null> {
  if (!rawValue) {
    return null;
  }

  const normalizedValue = normalize ? normalize(rawValue) : rawValue;
  if (!normalizedValue) {
    return null;
  }

  const types = identifierTypes.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
  if (types.length === 0) {
    return null;
  }

  const query = client
    .from("entity_identifiers")
    .select("entity_id")
    .eq("identifier_value", normalizedValue)
    .limit(1);

  if (types.length === 1) {
    query.eq("identifier_type", types[0]);
  } else {
    query.in("identifier_type", types);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn(`Failed to resolve entity by ${context}`, error);
    return null;
  }

  return data?.entity_id ?? null;
}

export async function resolveEntityId(client: SupabaseClient, user: User): Promise<string | null> {
  const { data: accountRow, error: accountError } = await client
    .from("accounts")
    .select("entity_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError) {
    console.warn("Failed to resolve entity via accounts", accountError);
  } else if (accountRow?.entity_id) {
    return accountRow.entity_id;
  }

  const accountlessEntity = await lookupEntityIdByIdentifier(
    client,
    ["AUTH_UID", "auth_uid"],
    user.id,
    (value) => (typeof value === "string" && value.trim().length > 0 ? value : null),
    "auth uid",
  );
  if (accountlessEntity) {
    return accountlessEntity;
  }

  const emailEntity = await lookupEntityIdByIdentifier(
    client,
    ["EMAIL", "email"],
    user.email ?? null,
    normalizeEmail,
    "email",
  );
  if (emailEntity) {
    return emailEntity;
  }

  const phoneEntity = await lookupEntityIdByIdentifier(
    client,
    ["PHONE", "phone"],
    user.phone ?? null,
    normalizePhone,
    "phone",
  );
  if (phoneEntity) {
    return phoneEntity;
  }

  const { data, error } = await client
    .from("entities")
    .select("id")
    .eq("profile->>auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Failed to resolve entity by auth user id", error);
    return null;
  }

  return data?.id ?? null;
}

function toArray<T>(values: Iterable<T>): T[] {
  return Array.from(values);
}

function buildAssignments(
  platformRoles: string[] | null | undefined,
  guildRoles: Array<{ role: string | null }> | null | undefined,
  houseRoles: Array<{ role: string | null }> | null | undefined,
): RoleAssignments {
  if (!platformRoles && !guildRoles && !houseRoles) {
    return cloneEmptyRoles();
  }

  const platform = new Set<string>();
  for (const role of platformRoles ?? []) {
    if (typeof role === "string" && role.trim()) {
      platform.add(role.trim());
    }
  }

  const guild = new Set<string>();
  for (const entry of guildRoles ?? []) {
    if (typeof entry?.role === "string" && entry.role.trim()) {
      guild.add(entry.role.trim());
    }
  }

  const house = new Set<string>();
  for (const entry of houseRoles ?? []) {
    if (typeof entry?.role === "string" && entry.role.trim()) {
      house.add(entry.role.trim());
    }
  }

  return {
    PLATFORM: toArray(platform),
    GUILD: toArray(guild),
    HOUSE: toArray(house),
  } satisfies RoleAssignments;
}

export async function getMyRoles(
  supabase: SupabaseClient | null | undefined,
): Promise<RoleAssignments> {
  if (!supabase) {
    console.warn("Supabase client unavailable for role lookup");
    return cloneEmptyRoles();
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    return cloneEmptyRoles();
  }

  const entityId = await resolveEntityId(supabase, user);
  if (!entityId) {
    return cloneEmptyRoles();
  }

  const [platformResult, guildResult, houseResult] = await Promise.all([
    supabase
      .from("platform_roles")
      .select("roles")
      .eq("entity_id", entityId)
      .maybeSingle(),
    supabase.from("guild_roles").select("role").eq("entity_id", entityId),
    supabase.from("house_roles").select("role").eq("entity_id", entityId),
  ]);

  if (platformResult.error) {
    console.warn("Failed to load platform roles", platformResult.error);
  }
  if (guildResult.error) {
    console.warn("Failed to load guild roles", guildResult.error);
  }
  if (houseResult.error) {
    console.warn("Failed to load house roles", houseResult.error);
  }

  return buildAssignments(platformResult.data?.roles, guildResult.data ?? [], houseResult.data ?? []);
}

export async function getMyEntityId(
  supabase: SupabaseClient | null | undefined,
): Promise<string | null> {
  if (!supabase) {
    console.warn("Supabase client unavailable for entity lookup");
    return null;
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    return null;
  }

  return resolveEntityId(supabase, user);
}

function hasPlatformBypass(roles: RoleAssignments): boolean {
  return roles.PLATFORM.includes("game_master");
}

export function hasRoleInAssignments(
  roles: RoleAssignments,
  scope: RoleScope,
  role: string,
): boolean {
  if (!role) return false;

  if (hasPlatformBypass(roles)) {
    return true;
  }

  const pool = roles[scope];
  return Array.isArray(pool) ? pool.includes(role) : false;
}

export function isRoleAssignmentsEmpty(roles: RoleAssignments): boolean {
  return roles.PLATFORM.length === 0 && roles.GUILD.length === 0 && roles.HOUSE.length === 0;
}

export function emptyRoleAssignments(): RoleAssignments {
  return cloneEmptyRoles();
}
