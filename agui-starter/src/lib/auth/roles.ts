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

export function hasAllianceRole({ roles, entityId, allianceId, role }: AllianceRoleCheck): boolean {
  return hasRole(
    roles,
    entityId ?? null,
    (entry) => (allianceId ? entry.alliance_id === allianceId : true),
    role,
  );
}

export function hasGuildRole({ roles, entityId, guildId, role }: GuildRoleCheck): boolean {
  return hasRole(
    roles,
    entityId ?? null,
    (entry) => (guildId ? entry.guild_id === guildId : true),
    role,
  );
}

export function hasHouseRole({ roles, entityId, houseId, role }: HouseRoleCheck): boolean {
  return hasRole(
    roles,
    entityId ?? null,
    (entry) => (houseId ? entry.house_id === houseId : true),
    role,
  );
}
