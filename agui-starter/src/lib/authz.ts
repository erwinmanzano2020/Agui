import type { SupabaseClient, User } from "@supabase/supabase-js";

export type RoleScope = "PLATFORM" | "GUILD" | "HOUSE";

export type RoleAssignments = Record<RoleScope, string[]>;

export type EntityResolutionReport = {
  source: string | null;
  entityId: string | null;
  error?: string | null;
};

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

function extractEntityId(data: unknown): string | null {
  if (Array.isArray(data)) {
    for (const entry of data) {
      if (entry && typeof entry === "object" && typeof (entry as { entity_id?: unknown }).entity_id === "string") {
        return (entry as { entity_id: string }).entity_id;
      }
    }
    return null;
  }

  if (data && typeof data === "object" && typeof (data as { entity_id?: unknown }).entity_id === "string") {
    return (data as { entity_id: string }).entity_id;
  }

  return null;
}

async function resolveEntityBySimpleIdentifiers(
  client: SupabaseClient,
  user: User,
): Promise<{ entityId: string | null; error: string | null }> {
  const authUid = typeof user.id === "string" ? user.id.trim() : "";
  const normalizedEmail = normalizeEmail(user.email ?? null);
  const rawEmail = typeof user.email === "string" ? user.email.trim() : null;

  const searchValues = new Set<string>();
  if (authUid) {
    searchValues.add(authUid);
  }
  if (normalizedEmail) {
    searchValues.add(normalizedEmail);
  }
  if (rawEmail && rawEmail !== normalizedEmail) {
    searchValues.add(rawEmail);
  }

  if (searchValues.size === 0) {
    return { entityId: null, error: null };
  }

  const fallbackEntityId = authUid || null;

  try {
    const query = client
      .from("entity_identifiers")
      .select("entity_id")
      .in("identifier_value", Array.from(searchValues))
      .in("identifier_type", ["auth_uid", "email", "EMAIL"])
      .limit(1);

    const { data, error } = await query;
    if (error) {
      console.error("[authz] entity lookup failed (simple resolver)", error);
      const message = typeof (error as { message?: unknown }).message === "string" ? (error as { message: string }).message : null;
      if (isIdentifierPermissionDenied(error)) {
        return { entityId: fallbackEntityId, error: message };
      }
      return { entityId: null, error: message };
    }

    return { entityId: extractEntityId(data), error: null };
  } catch (error) {
    console.error("[authz] entity lookup crashed (simple resolver)", error);
    return { entityId: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function isIdentifierPermissionDenied(error: unknown): boolean {
  const message = typeof (error as { message?: unknown })?.message === "string" ? (error as { message: string }).message : "";
  return message.toLowerCase().includes("permission denied for table entity_identifiers");
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message = typeof (error as { message?: unknown }).message === "string" ? (error as { message: string }).message : "";
  if (!message) {
    return false;
  }
  const lowered = message.toLowerCase();
  return lowered.includes("column") && lowered.includes("does not exist");
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
  const rawCandidate = typeof rawValue === "string" ? rawValue.trim() : null;

  const searchValues: Array<{ value: string; isNormalized: boolean }> = [];
  if (typeof normalizedValue === "string" && normalizedValue.trim().length > 0) {
    searchValues.push({ value: normalizedValue.trim(), isNormalized: true });
  }
  if (typeof rawCandidate === "string" && rawCandidate.length > 0) {
    const alreadyPresent = searchValues.some((entry) => entry.value === rawCandidate);
    if (!alreadyPresent) {
      searchValues.push({ value: rawCandidate, isNormalized: false });
    }
  }

  if (searchValues.length === 0) {
    return null;
  }

  const expandedTypes = Array.from(
    new Set(
      identifierTypes
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
        .flatMap((entry) => {
          const lower = entry.toLowerCase();
          return [entry, lower];
        }),
    ),
  ).filter((entry) => entry && entry.trim().length > 0);

  type ColumnVariant = {
    valueColumn: "identifier_value" | "value_norm";
    typeColumn: "identifier_type" | "kind";
    mapType: (value: string) => string;
    allowUnnormalized: boolean;
  };

  const columnVariants: ColumnVariant[] = [
    {
      valueColumn: "identifier_value",
      typeColumn: "identifier_type",
      mapType: (value) => value,
      allowUnnormalized: true,
    },
    {
      valueColumn: "value_norm",
      typeColumn: "kind",
      mapType: (value) => value.toLowerCase(),
      allowUnnormalized: false,
    },
  ];

  for (const { value, isNormalized } of searchValues) {
    for (const variant of columnVariants) {
      if (!variant.allowUnnormalized && !isNormalized) {
        continue;
      }

      const typeSets: Array<string[] | null> = [];
      if (expandedTypes.length > 0) {
        typeSets.push(expandedTypes);
      }
      typeSets.push(null);

      for (const typeSet of typeSets) {
        try {
          const query = client
            .from("entity_identifiers")
            .select("entity_id")
            .eq(variant.valueColumn, value)
            .limit(1);

          if (typeSet && typeSet.length > 0) {
            const transformed = Array.from(new Set(typeSet.map((entry) => variant.mapType(entry)).filter((entry) => entry)));
            if (transformed.length === 1) {
              query.eq(variant.typeColumn, transformed[0]);
            } else if (transformed.length > 1) {
              query.in(variant.typeColumn, transformed);
            }
          }

          const { data, error } = await query;
          if (error) {
            if (isMissingColumnError(error)) {
              break;
            }
            console.warn(`Failed to resolve entity by ${context}`, error);
            break;
          }

          const entityId = extractEntityId(data);
          if (entityId) {
            return entityId;
          }
        } catch (error) {
          if (isMissingColumnError(error)) {
            break;
          }
          console.warn(`Failed to resolve entity by ${context}`, error);
          break;
        }
      }
    }
  }

  return null;
}

export async function resolveEntityId(
  client: SupabaseClient,
  user: User,
  options?: { lookupClient?: SupabaseClient; report?: (details: EntityResolutionReport) => void },
): Promise<string | null> {
  const reader = options?.lookupClient ?? client;
  let resolutionSource: string | null = null;
  let resolutionError: string | null = null;

  const simpleResult = await resolveEntityBySimpleIdentifiers(client, user);
  if (simpleResult.error) {
    resolutionError = simpleResult.error;
  }
  if (simpleResult.entityId) {
    resolutionSource = "simpleResolver";
    options?.report?.({ source: resolutionSource, entityId: simpleResult.entityId, error: resolutionError });
    return simpleResult.entityId;
  }

  const { data: accountRow, error: accountError } = await reader
    .from("accounts")
    .select("entity_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError) {
    console.warn("Failed to resolve entity via accounts", accountError);
  } else if (accountRow?.entity_id) {
    resolutionSource = "accounts";
    options?.report?.({ source: resolutionSource, entityId: accountRow.entity_id, error: resolutionError });
    return accountRow.entity_id;
  }

  const accountlessEntity = await lookupEntityIdByIdentifier(
    reader,
    ["auth_uid"],
    user.id,
    (value) => (typeof value === "string" && value.trim().length > 0 ? value : null),
    "auth uid",
  );
  if (accountlessEntity) {
    resolutionSource = "identifier:auth_uid";
    options?.report?.({ source: resolutionSource, entityId: accountlessEntity, error: resolutionError });
    return accountlessEntity;
  }

  const emailEntity = await lookupEntityIdByIdentifier(
    reader,
    ["EMAIL", "email"],
    user.email ?? null,
    normalizeEmail,
    "email",
  );
  if (emailEntity) {
    resolutionSource = "identifier:email";
    options?.report?.({ source: resolutionSource, entityId: emailEntity, error: resolutionError });
    return emailEntity;
  }

  const phoneEntity = await lookupEntityIdByIdentifier(
    reader,
    ["PHONE", "phone"],
    user.phone ?? null,
    normalizePhone,
    "phone",
  );
  if (phoneEntity) {
    resolutionSource = "identifier:phone";
    options?.report?.({ source: resolutionSource, entityId: phoneEntity, error: resolutionError });
    return phoneEntity;
  }

  const { data, error } = await reader
    .from("entities")
    .select("id")
    .eq("profile->>auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Failed to resolve entity by auth user id", error);
    resolutionError = resolutionError ?? (error instanceof Error ? error.message : typeof error === "string" ? error : null);
    options?.report?.({ source: resolutionSource, entityId: null, error: resolutionError });
    return null;
  }

  const resolved = data?.id ?? null;
  if (resolved) {
    resolutionSource = "entities.profile";
  }
  options?.report?.({ source: resolutionSource, entityId: resolved ?? null, error: resolutionError });
  return resolved ?? null;
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
  options?: { lookupClient?: SupabaseClient; report?: (details: EntityResolutionReport) => void },
): Promise<RoleAssignments> {
  if (!supabase) {
    console.warn("Supabase client unavailable for role lookup");
    return cloneEmptyRoles();
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    return cloneEmptyRoles();
  }

  const entityId = await resolveEntityId(supabase, user, options);
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
  options?: { lookupClient?: SupabaseClient; report?: (details: EntityResolutionReport) => void },
): Promise<string | null> {
  if (!supabase) {
    console.warn("Supabase client unavailable for entity lookup");
    return null;
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    return null;
  }

  return resolveEntityId(supabase, user, options);
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
