import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentEntityAndPolicies } from "@/lib/policy/server";
import { buildSectionsForWorkspace, buildTilesResponse } from "./compute";
import type {
  AppCatalogEntry,
  AppVisibilityRule,
  BuildTilesInput,
  LoyaltyMembership,
  TileAssignment,
  TilesMeResponse,
  WorkspaceDescriptor,
  WorkspaceRole,
  WorkspaceSections,
} from "./types";
import { getEffectiveSetting } from "@/lib/settings/server";
import { emitEvent } from "@/lib/events/server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { isOptionalTableError } from "@/lib/supabase/errors";

import { normalizeWorkspaceRole } from "@/lib/workspaces/roles";

function deriveWorkspaceRoleFromEmployment(
  roleSlug: string | null | undefined,
): WorkspaceRole {
  if (!roleSlug) {
    return "staff";
  }

  const normalized = roleSlug.toLowerCase();
  if (normalized.includes("owner")) {
    return "owner";
  }
  if (normalized.includes("manager") || normalized.includes("admin") || normalized.includes("gm")) {
    return "manager";
  }
  return "staff";
}

function appendWorkspaceRole(target: WorkspaceDescriptor, role: WorkspaceRole) {
  if (!target.roles.includes(role)) {
    target.roles.push(role);
  }
}

function parseBusinessId(context: unknown): string | null {
  if (!context || typeof context !== "object") {
    return null;
  }
  if ("businessId" in context && typeof (context as Record<string, unknown>).businessId === "string") {
    return (context as Record<string, unknown>).businessId as string;
  }
  if ("business_id" in context && typeof (context as Record<string, unknown>).business_id === "string") {
    return (context as Record<string, unknown>).business_id as string;
  }
  if ("houseId" in context && typeof (context as Record<string, unknown>).houseId === "string") {
    return (context as Record<string, unknown>).houseId as string;
  }
  if ("house_id" in context && typeof (context as Record<string, unknown>).house_id === "string") {
    return (context as Record<string, unknown>).house_id as string;
  }
  return null;
}

async function loadLoyaltyMemberships(
  supabase: SupabaseClient,
  entityId: string,
): Promise<LoyaltyMembership[]> {
  const { data, error } = await supabase
    .from("loyalty_profiles")
    .select("scheme:loyalty_schemes(id,name,design)")
    .eq("entity_id", entityId);

  if (error) {
    console.warn("Failed to load loyalty profiles for tiles", error);
    return [];
  }

  const memberships: Array<{ businessId: string; schemeName: string; slug: string | null }> = [];
  const houseIds = new Set<string>();

  for (const row of data ?? []) {
    const schemeRaw = (row as { scheme?: unknown }).scheme;
    if (!schemeRaw || typeof schemeRaw !== "object" || Array.isArray(schemeRaw)) {
      continue;
    }
    const scheme = schemeRaw as { id?: unknown; name?: unknown; design?: unknown };
    const design =
      scheme && typeof scheme.design === "object" && scheme.design !== null
        ? (scheme.design as Record<string, unknown>)
        : {};
    const houseId = typeof design.house_id === "string" ? design.house_id : null;
    const houseSlug = typeof design.house_slug === "string" ? design.house_slug : null;
    if (!houseId) {
      continue;
    }
    houseIds.add(houseId);
    memberships.push({
      businessId: houseId,
      schemeName: typeof scheme.name === "string" ? scheme.name : "Loyalty Pass",
      slug: houseSlug,
    });
  }

  if (houseIds.size === 0) {
    return memberships.map((entry) => ({ businessId: entry.businessId, label: entry.schemeName }));
  }

  const { data: houses, error: housesError } = await supabase
    .from("houses")
    .select("id,name")
    .in("id", Array.from(houseIds));

  if (housesError) {
    console.warn("Failed to resolve houses for loyalty memberships", housesError);
  }

  const nameById = new Map<string, string>();
  for (const house of houses ?? []) {
    const id = typeof (house as { id?: string }).id === "string" ? (house as { id: string }).id : null;
    if (!id) {
      continue;
    }
    const name = typeof (house as { name?: string | null }).name === "string" ? (house as { name: string }).name : null;
    if (name) {
      nameById.set(id, name);
    }
  }

  return memberships.map((entry) => {
    const base = nameById.get(entry.businessId);
    return {
      businessId: entry.businessId,
      label: base ? `${base} Pass` : entry.schemeName,
    } satisfies LoyaltyMembership;
  });
}

async function loadWorkspaceDescriptors(
  supabase: SupabaseClient,
  entityId: string,
): Promise<WorkspaceDescriptor[]> {
  const { data, error } = await supabase
    .from("house_roles")
    .select("role, house:houses(id,name,slug)")
    .eq("entity_id", entityId);

  if (error) {
    console.warn("Failed to load house roles for tiles", error);
    return [];
  }

  const byHouse = new Map<string, WorkspaceDescriptor>();

  for (const raw of data ?? []) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const houseRaw = (raw as { house?: unknown }).house;
    if (!houseRaw || typeof houseRaw !== "object" || Array.isArray(houseRaw)) {
      continue;
    }
    const house = houseRaw as { id?: unknown; name?: unknown; slug?: unknown };
    const id = typeof house.id === "string" ? house.id : null;
    if (!id) {
      continue;
    }
    if (!byHouse.has(id)) {
      const name = typeof house.name === "string" ? house.name : null;
      const slug = typeof house.slug === "string" ? house.slug : null;
      byHouse.set(id, {
        businessId: id,
        label: name && name.trim().length > 0 ? name : slug ?? id,
        slug: slug ?? null,
        roles: [],
        enabledApps: [],
      });
    }
    const descriptor = byHouse.get(id)!;
    const roleValue = (raw as { role?: unknown }).role;
    appendWorkspaceRole(
      descriptor,
      normalizeWorkspaceRole(typeof roleValue === "string" ? roleValue : null),
    );
  }

  const { data: employmentRows, error: employmentError } = await supabase
    .from("employments")
    .select(
      "status, business:houses(id,name,slug), role:roles(id,slug)"
    )
    .eq("entity_id", entityId);

  if (employmentError) {
    console.warn("Failed to load employments for tiles", employmentError);
  }

  for (const raw of employmentRows ?? []) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const status = (raw as { status?: string | null }).status ?? null;
    if (status !== "active") {
      continue;
    }

    const businessRaw = (raw as { business?: unknown }).business;
    if (!businessRaw || typeof businessRaw !== "object") {
      continue;
    }

    const business = businessRaw as { id?: unknown; name?: unknown; slug?: unknown };
    const businessId = typeof business.id === "string" ? business.id : null;
    if (!businessId) {
      continue;
    }

    if (!byHouse.has(businessId)) {
      const name = typeof business.name === "string" ? business.name : null;
      const slug = typeof business.slug === "string" ? business.slug : null;
      byHouse.set(businessId, {
        businessId,
        label: name && name.trim().length > 0 ? name : slug ?? businessId,
        slug: slug ?? null,
        roles: [],
        enabledApps: [],
      });
    }

    const descriptor = byHouse.get(businessId)!;
    const roleObj = (raw as { role?: unknown }).role;
    const roleSlug =
      roleObj && typeof roleObj === "object" && roleObj !== null
        ? ((roleObj as { slug?: unknown }).slug as string | null | undefined)
        : null;
    appendWorkspaceRole(descriptor, deriveWorkspaceRoleFromEmployment(roleSlug));
  }

  return Array.from(byHouse.values());
}

async function loadTileAssignments(
  supabase: SupabaseClient,
  entityId: string,
): Promise<TileAssignment[]> {
  const { data, error } = await supabase
    .from("tile_assignments")
    .select("app_key, context, visible")
    .eq("entity_id", entityId);

  if (error) {
    if (isOptionalTableError(error)) {
      return [];
    }
    console.warn("Failed to load tile assignments", error);
    return [];
  }

  const assignments: TileAssignment[] = [];
  for (const row of data ?? []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const appKey = typeof (row as { app_key?: unknown }).app_key === "string" ? (row as { app_key: string }).app_key : null;
    if (!appKey) {
      continue;
    }
    const context = (row as { context?: unknown }).context ?? null;
    const visibleRaw = (row as { visible?: boolean | null }).visible;
    assignments.push({
      appKey,
      businessId: parseBusinessId(context),
      visible: visibleRaw !== false,
    });
  }

  return assignments;
}

async function loadAppsCatalog(supabase: SupabaseClient): Promise<AppCatalogEntry[]> {
  const { data, error } = await supabase.from("apps").select("key,name,category,tags");

  if (error) {
    if (!isOptionalTableError(error)) {
      console.warn("Failed to load app catalog", error);
    }
    return [];
  }

  return (data ?? []).flatMap((row) => {
    const key = typeof (row as { key?: string }).key === "string" ? (row as { key: string }).key : null;
    const name = typeof (row as { name?: string }).name === "string" ? (row as { name: string }).name : null;
    if (!key || !name) {
      return [];
    }
    const categoryRaw = (row as { category?: string | null }).category;
    const tagsRaw = (row as { tags?: unknown }).tags;
    return [
      {
        key,
        name,
        category: typeof categoryRaw === "string" ? categoryRaw : "Tools",
        tags: Array.isArray(tagsRaw)
          ? tagsRaw.filter((value): value is string => typeof value === "string")
          : [],
      },
    ];
  });
}

async function loadVisibilityRules(supabase: SupabaseClient): Promise<AppVisibilityRule[]> {
  const { data, error } = await supabase
    .from("app_visibility_rules")
    .select("app_key, min_role, require_policies");

  if (error) {
    if (!isOptionalTableError(error)) {
      console.warn("Failed to load app visibility rules", error);
    }
    return [];
  }

  return (data ?? []).flatMap((row) => {
    const appKey = typeof (row as { app_key?: string }).app_key === "string" ? (row as { app_key: string }).app_key : null;
    if (!appKey) {
      return [];
    }
    const minRoleRaw = (row as { min_role?: string | null }).min_role;
    const requirePoliciesRaw = (row as { require_policies?: unknown }).require_policies;
    const minRole =
      minRoleRaw === "customer" ||
      minRoleRaw === "employee" ||
      minRoleRaw === "owner" ||
      minRoleRaw === "gm"
        ? minRoleRaw
        : undefined;
    const requirePolicies = Array.isArray(requirePoliciesRaw)
      ? requirePoliciesRaw.filter((value): value is string => typeof value === "string")
      : [];
    return [
      {
        appKey,
        minRole,
        requirePolicies,
      },
    ];
  });
}

async function loadInboxUnreadCount(supabase: SupabaseClient, entityId: string): Promise<number> {
  const { count, error } = await supabase
    .from("app_inbox")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", entityId)
    .is("read_at", null);

  if (error) {
    console.warn("Failed to load inbox count for tiles", error);
    return 0;
  }

  return count ?? 0;
}

async function loadGmAccess(supabase: SupabaseClient, entityId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("platform_roles")
    .select("roles")
    .eq("entity_id", entityId)
    .maybeSingle<{ roles: string[] | null }>();

  if (error) {
    if (!isOptionalTableError(error)) {
      console.warn("Failed to load platform roles for tiles", error);
    }
    return false;
  }

  const roles = data?.roles ?? [];
  return Array.isArray(roles) && roles.includes("game_master");
}

async function buildInputForEntity(
  supabase: SupabaseClient,
  entityId: string,
  policyKeys: string[],
  options: { gmStartTileOverride: boolean },
): Promise<BuildTilesInput> {
  const [
    loyalties,
    workspaces,
    tileAssignments,
    apps,
    visibilityRules,
    inboxUnreadCount,
    gmAccess,
  ] = await Promise.all([
    loadLoyaltyMemberships(supabase, entityId),
    loadWorkspaceDescriptors(supabase, entityId),
    loadTileAssignments(supabase, entityId),
    loadAppsCatalog(supabase),
    loadVisibilityRules(supabase),
    loadInboxUnreadCount(supabase, entityId),
    loadGmAccess(supabase, entityId),
  ]);

  const uniqueBusinessIds = new Set(workspaces.map((workspace) => workspace.businessId));

  return {
    loyalties,
    workspaces,
    tileAssignments,
    policies: policyKeys,
    gmAccess,
    inboxUnreadCount,
    apps,
    visibilityRules,
    businessCount: uniqueBusinessIds.size,
    alwaysShowStartBusinessTile: Boolean(gmAccess && options.gmStartTileOverride),
  } satisfies BuildTilesInput;
}

export function appendAuthzDebug(
  response: TilesMeResponse,
  authz: {
    entityId: string | null;
    policyKeys: string[];
    source?: string | null;
    error?: string | null;
    policyError?: string | null;
  },
): TilesMeResponse {
  const existingDebug = (response as TilesMeResponse & { _debug?: Record<string, unknown> })._debug ?? {};
  const policyKeys = Array.isArray(authz.policyKeys) ? [...authz.policyKeys] : [];

  return {
    ...response,
    _debug: {
      ...existingDebug,
      authz: {
        entityId: authz.entityId,
        policyKeys,
        source: authz.source ?? null,
        error: authz.error ?? null,
        policyError: authz.policyError ?? null,
      },
    },
  } satisfies TilesMeResponse;
}

export async function loadTilesForCurrentUser(): Promise<TilesMeResponse> {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, authzState] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentEntityAndPolicies(supabase, { context: "tiles" }),
  ]);
  const { entityId } = authzState;

  if (error) {
    console.warn("Failed to resolve current user while loading tiles", error);
  }

  const user = data?.user ?? null;
  if (!user || !entityId) {
    return { home: [], workspaces: [] } satisfies TilesMeResponse;
  }

  let tilesClient: SupabaseClient;
  try {
    tilesClient = getServiceSupabase();
  } catch (serviceError) {
    console.warn("Falling back to session client for tiles", serviceError);
    tilesClient = supabase;
  }

  const gmStartTileOverride = Boolean(
    await getEffectiveSetting("gm.ui.always_show_start_business_tile", {}, { client: supabase }),
  );

  const policyKeys = [...authzState.policyKeys].sort();
  const cacheKey = policyKeys.join("|");
  const gmStartCacheKey = gmStartTileOverride ? "gm-start:on" : "gm-start:off";
  const cachedLoader = unstable_cache(
    async () => {
      const input = await buildInputForEntity(tilesClient, entityId, policyKeys, {
        gmStartTileOverride,
      });
      return buildTilesResponse(input);
    },
    ["tiles", "me", user.id, entityId, cacheKey, gmStartCacheKey],
    { tags: [`tiles:user:${user.id}`], revalidate: 60 },
  );

  const response = await cachedLoader();

  if (process.env.NODE_ENV !== "production") {
    const augmented = appendAuthzDebug(response, {
      entityId,
      policyKeys,
      source: authzState.source,
      error: authzState.error,
      policyError: authzState.policyError,
    });

    if (augmented.home.some((tile) => tile.kind === "start-business")) {
      try {
        const gmAccess = await loadGmAccess(supabase, entityId);
        await emitEvent(
          "tiles_start_business_shown",
          "info",
          {
            actorEntityId: entityId,
            isGM: gmAccess,
            hadWorkspacesBefore: augmented.workspaces.length > 0,
          },
          { skipRevalidate: true },
        );
      } catch (eventError) {
        console.warn("Failed to emit start business telemetry", eventError);
      }
    }

    return augmented;
  }

  if (response.home.some((tile) => tile.kind === "start-business")) {
    try {
      const gmAccess = await loadGmAccess(supabase, entityId);
      await emitEvent(
        "tiles_start_business_shown",
        "info",
        {
          actorEntityId: entityId,
          isGM: gmAccess,
          hadWorkspacesBefore: response.workspaces.length > 0,
        },
        { skipRevalidate: true },
      );
    } catch (eventError) {
      console.warn("Failed to emit start business telemetry", eventError);
    }
  }

  return response;
}

export async function loadWorkspaceSectionsForSlug(slug: string): Promise<WorkspaceSections | null> {
  const supabase = await createServerSupabaseClient();
  const { entityId, policyKeys } = await getCurrentEntityAndPolicies(supabase, {
    context: "tiles.sections",
  });
  if (!entityId) {
    return null;
  }

  const { data: house, error } = await supabase
    .from("houses")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle<{ id: string; name: string | null; slug: string | null }>();

  if (error) {
    console.warn("Failed to load house for sections", error);
    return null;
  }

  if (!house) {
    return null;
  }

  const { data: houseRoles, error: rolesError } = await supabase
    .from("house_roles")
    .select("role")
    .eq("entity_id", entityId)
    .eq("house_id", house.id);

  if (rolesError) {
    console.warn("Failed to resolve workspace roles for sections", rolesError);
  }

  const descriptor: WorkspaceDescriptor = {
    businessId: house.id,
    label: house.name ?? house.slug ?? house.id,
    slug: house.slug,
    roles: (houseRoles ?? []).map((row) => normalizeWorkspaceRole((row as { role?: string | null }).role ?? null)),
    enabledApps: [],
  };

  return buildSectionsForWorkspace(descriptor, new Set(policyKeys));
}
