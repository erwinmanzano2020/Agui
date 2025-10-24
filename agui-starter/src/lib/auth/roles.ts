import { getSupabase } from "@/lib/supabase";

type RoleTarget = string | string[] | null | undefined;

export type AllianceRoleLike = {
  alliance_id: string;
  entity_id: string;
  role: string;
};

export type GuildRoleLike = {
  guild_id: string;
  entity_id: string;
  role: string;
};

export type HouseRoleLike = {
  house_id: string;
  entity_id: string;
  role: string;
};

type AllianceRoleCheck = {
  roles?: AllianceRoleLike[] | null;
  entityId?: string | null;
  allianceId?: string | null;
  role?: RoleTarget;
};

type GuildRoleCheck = {
  roles?: GuildRoleLike[] | null;
  entityId?: string | null;
  guildId?: string | null;
  role?: RoleTarget;
};

type HouseRoleCheck = {
  roles?: HouseRoleLike[] | null;
  entityId?: string | null;
  houseId?: string | null;
  role?: RoleTarget;
};

function normalizeRole(value: string): string {
  return value.trim().toLowerCase();
}

function matchesRole(candidate: string, target: RoleTarget): boolean {
  if (!target || (Array.isArray(target) && target.length === 0)) {
    return true;
  }

  const normalizedCandidate = normalizeRole(candidate);

  if (Array.isArray(target)) {
    return target.some((entry) =>
      typeof entry === "string" && normalizeRole(entry) === normalizedCandidate,
    );
  }

  return typeof target === "string" && normalizeRole(target) === normalizedCandidate;
}

function hasRole<T extends { entity_id: string; role: string }>(
  entries: T[] | null | undefined,
  entityId: string | null | undefined,
  predicate: (entry: T) => boolean,
  role: RoleTarget,
): boolean {
  if (!entries || entries.length === 0) return false;
  if (!entityId) return false;

  for (const entry of entries) {
    if (entry.entity_id !== entityId) continue;
    if (!matchesRole(entry.role, role)) continue;
    if (!predicate(entry)) continue;
    return true;
  }

  return false;
}

function hasAllianceRoleLocal({ roles, entityId, allianceId, role }: AllianceRoleCheck): boolean {
  return hasRole(
    roles,
    entityId ?? null,
    (entry) => (allianceId ? entry.alliance_id === allianceId : true),
    role,
  );
}

function hasGuildRoleLocal({ roles, entityId, guildId, role }: GuildRoleCheck): boolean {
  return hasRole(
    roles,
    entityId ?? null,
    (entry) => (guildId ? entry.guild_id === guildId : true),
    role,
  );
}

function hasHouseRoleLocal({ roles, entityId, houseId, role }: HouseRoleCheck): boolean {
  return hasRole(
    roles,
    entityId ?? null,
    (entry) => (houseId ? entry.house_id === houseId : true),
    role,
  );
}

async function hasAllianceRoleRemote(entityId: string, allianceId: string, roles: string[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || !allianceId || roles.length === 0) return false;
  const { data, error } = await client
    .from("alliance_roles")
    .select("role")
    .eq("entity_id", entityId)
    .eq("alliance_id", allianceId);
  if (error) return false;
  return data?.some((entry) => roles.includes(entry.role)) ?? false;
}

async function hasGuildRoleRemote(entityId: string, guildId: string, roles: string[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || !guildId || roles.length === 0) return false;
  const { data, error } = await client
    .from("guild_roles")
    .select("role")
    .eq("entity_id", entityId)
    .eq("guild_id", guildId);
  if (error) return false;
  return data?.some((entry) => roles.includes(entry.role)) ?? false;
}

async function hasHouseRoleRemote(entityId: string, houseId: string, roles: string[]): Promise<boolean> {
  const client = getSupabase();
  if (!client || !houseId || roles.length === 0) return false;
  const { data, error } = await client
    .from("house_roles")
    .select("role")
    .eq("entity_id", entityId)
    .eq("house_id", houseId);
  if (error) return false;
  return data?.some((entry) => roles.includes(entry.role)) ?? false;
}

export function hasAllianceRole(args: AllianceRoleCheck): boolean;
export function hasAllianceRole(entityId: string, allianceId: string, roles: string[]): Promise<boolean>;
export function hasAllianceRole(
  arg1: AllianceRoleCheck | string,
  allianceId?: string,
  roles?: string[],
): boolean | Promise<boolean> {
  if (typeof arg1 === "string") {
    return hasAllianceRoleRemote(arg1, allianceId ?? "", roles ?? []);
  }
  return hasAllianceRoleLocal(arg1);
}

export function hasGuildRole(args: GuildRoleCheck): boolean;
export function hasGuildRole(entityId: string, guildId: string, roles: string[]): Promise<boolean>;
export function hasGuildRole(
  arg1: GuildRoleCheck | string,
  guildId?: string,
  roles?: string[],
): boolean | Promise<boolean> {
  if (typeof arg1 === "string") {
    return hasGuildRoleRemote(arg1, guildId ?? "", roles ?? []);
  }
  return hasGuildRoleLocal(arg1);
}

export function hasHouseRole(args: HouseRoleCheck): boolean;
export function hasHouseRole(entityId: string, houseId: string, roles: string[]): Promise<boolean>;
export function hasHouseRole(
  arg1: HouseRoleCheck | string,
  houseId?: string,
  roles?: string[],
): boolean | Promise<boolean> {
  if (typeof arg1 === "string") {
    return hasHouseRoleRemote(arg1, houseId ?? "", roles ?? []);
  }
  return hasHouseRoleLocal(arg1);
}
