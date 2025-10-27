import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";

export type Feature =
  | "alliances"
  | "guilds"
  | "team"
  | "shifts"
  | "dtr-bulk"
  | "payroll"
  | "pos"
  | "alliance-pass"
  | "settings";

export type RoleScope = "PLATFORM" | "GUILD" | "HOUSE";

export type RoleRequirement = { scope: RoleScope; role: string };

export const FEATURE_ROLES: Record<Feature, RoleRequirement[]> = {
  alliances: [{ scope: "PLATFORM", role: "game_master" }],
  guilds: [
    { scope: "GUILD", role: "guild_master" },
    { scope: "PLATFORM", role: "game_master" },
  ],
  team: [{ scope: "HOUSE", role: "house_manager" }],
  shifts: [{ scope: "HOUSE", role: "house_manager" }],
  "dtr-bulk": [{ scope: "HOUSE", role: "house_manager" }],
  payroll: [{ scope: "HOUSE", role: "house_manager" }],
  pos: [
    { scope: "HOUSE", role: "cashier" },
    { scope: "HOUSE", role: "house_manager" },
  ],
  "alliance-pass": [
    { scope: "GUILD", role: "guild_elder" },
    { scope: "PLATFORM", role: "game_master" },
  ],
  settings: [{ scope: "PLATFORM", role: "game_master" }],
};

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

async function getAuthedSupabaseClient(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) {
    return client;
  }

  if (typeof window === "undefined") {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    return createServerSupabaseClient();
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase client not initialized. Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return supabase;
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

async function resolveEntityId(client: SupabaseClient, user: User): Promise<string | null> {
  const email = normalizeEmail(user.email ?? null);
  if (email) {
    const { data, error } = await client
      .from("entity_identifiers")
      .select("entity_id")
      .eq("identifier_type", "EMAIL")
      .eq("identifier_value", email)
      .maybeSingle();

    if (error) {
      console.warn("Failed to resolve entity by email", error);
    } else if (data?.entity_id) {
      return data.entity_id;
    }
  }

  const phone = normalizePhone(user.phone ?? null);
  if (phone) {
    const { data, error } = await client
      .from("entity_identifiers")
      .select("entity_id")
      .eq("identifier_type", "PHONE")
      .eq("identifier_value", phone)
      .maybeSingle();

    if (error) {
      console.warn("Failed to resolve entity by phone", error);
    } else if (data?.entity_id) {
      return data.entity_id;
    }
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

export async function getMyRoles(client?: SupabaseClient): Promise<RoleAssignments> {
  let supabase: SupabaseClient;
  try {
    supabase = await getAuthedSupabaseClient(client);
  } catch (error) {
    console.warn("Failed to resolve Supabase client for roles", error);
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

export async function hasRole(
  scope: RoleScope,
  role: string,
  client?: SupabaseClient,
): Promise<boolean> {
  const roles = await getMyRoles(client);
  return hasRoleInAssignments(roles, scope, role);
}

export function canWithRoles(roles: RoleAssignments, feature: Feature): boolean {
  const requirements = FEATURE_ROLES[feature] ?? [];
  if (requirements.length === 0) {
    return true;
  }

  if (hasPlatformBypass(roles)) {
    return true;
  }

  return requirements.some((requirement) =>
    hasRoleInAssignments(roles, requirement.scope, requirement.role),
  );
}

export async function can(feature: Feature, client?: SupabaseClient): Promise<boolean> {
  const roles = await getMyRoles(client);
  return canWithRoles(roles, feature);
}

export { isGM } from "@/lib/identity/entity";

export function isRoleAssignmentsEmpty(roles: RoleAssignments): boolean {
  return roles.PLATFORM.length === 0 && roles.GUILD.length === 0 && roles.HOUSE.length === 0;
}

export function emptyRoleAssignments(): RoleAssignments {
  return cloneEmptyRoles();
}
