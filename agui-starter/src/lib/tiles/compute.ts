import {
  type AppCatalogEntry,
  type AppVisibilityRule,
  type BuildTilesInput,
  type HomeTile,
  type LoyaltyMembership,
  type MarketplaceCategory,
  type MarketplaceCategoryKey,
  type MarketplaceItem,
  type TileAssignment,
  type TilesMeResponse,
  type WorkspaceDescriptor,
  type WorkspaceRole,
  type WorkspaceSection,
  type WorkspaceSectionKey,
  type WorkspaceSections,
} from "./types";

const HOME_TILE_LIMIT = 8;

const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  guest: 0,
  staff: 1,
  manager: 2,
  owner: 3,
};

const MIN_ROLE_RANK: Record<NonNullable<AppVisibilityRule["minRole"]>, number> = {
  customer: 0,
  employee: 1,
  owner: 2,
  gm: 3,
};

const MARKETPLACE_CATEGORY_ORDER: MarketplaceCategoryKey[] = [
  "People",
  "Operations",
  "Finance",
  "Tools",
];

const SECTION_DEFINITIONS: Record<WorkspaceSectionKey, { label: string; apps: string[]; buildRoute: (slug: string | null) => string }>
  = {
    overview: {
      label: "Overview",
      apps: [],
      buildRoute: (slug) => (slug ? `/company/${slug}/overview` : "/company"),
    },
    people: {
      label: "People",
      apps: ["employees", "hr", "payslips"],
      buildRoute: (slug) => (slug ? `/company/${slug}/people/employees` : "/company"),
    },
    operations: {
      label: "Operations",
      apps: ["pos", "inventory", "purchasing"],
      buildRoute: (slug) => (slug ? `/company/${slug}/operations/pos` : "/company"),
    },
    finance: {
      label: "Finance",
      apps: ["ledger", "banking", "cheque_issuance", "payroll"],
      buildRoute: (slug) => (slug ? `/company/${slug}/finance/ledger` : "/company"),
    },
    settings: {
      label: "Settings",
      apps: ["my_businesses"],
      buildRoute: (slug) => (slug ? `/company/${slug}/settings` : "/company"),
    },
  };

function normalizeCategory(value: string): MarketplaceCategoryKey {
  if (value === "People" || value === "Operations" || value === "Finance") {
    return value;
  }
  return "Tools";
}

function highestWorkspaceRole(roles: WorkspaceRole[]): WorkspaceRole {
  if (!Array.isArray(roles) || roles.length === 0) {
    return "guest";
  }
  const sorted = [...roles].sort((a, b) => WORKSPACE_ROLE_RANK[b] - WORKSPACE_ROLE_RANK[a]);
  return sorted[0] ?? "guest";
}

function canSeePeople(role: WorkspaceRole, policyKeys: Set<string>): boolean {
  return role === "owner" || role === "manager" || policyKeys.has("tiles.team.read");
}

function canSeeOperations(role: WorkspaceRole, policyKeys: Set<string>): boolean {
  if (role === "owner" || role === "manager" || role === "staff") {
    return true;
  }
  return policyKeys.has("tiles.pos.read");
}

function canSeeFinance(role: WorkspaceRole, policyKeys: Set<string>): boolean {
  if (role === "owner") {
    return true;
  }
  return (
    policyKeys.has("domain.ledger.all") ||
    policyKeys.has("tiles.payroll.read") ||
    policyKeys.has("apps.payroll.discover")
  );
}

function canSeeSettings(role: WorkspaceRole, policyKeys: Set<string>): boolean {
  return role === "owner" || policyKeys.has("roles.manage.house") || policyKeys.has("tiles.settings.read");
}

const SECTION_GUARDS: Record<WorkspaceSectionKey, (role: WorkspaceRole, policies: Set<string>) => boolean> = {
  overview: () => true,
  people: canSeePeople,
  operations: canSeeOperations,
  finance: canSeeFinance,
  settings: canSeeSettings,
};

export function buildSectionsForWorkspace(
  workspace: WorkspaceDescriptor,
  policyKeys: Set<string>,
): WorkspaceSections {
  const role = highestWorkspaceRole(workspace.roles);
  const sections: WorkspaceSection[] = [];

  (Object.keys(SECTION_DEFINITIONS) as WorkspaceSectionKey[]).forEach((key) => {
    const guard = SECTION_GUARDS[key];
    if (!guard(role, policyKeys)) {
      return;
    }
    const definition = SECTION_DEFINITIONS[key];
    sections.push({
      key,
      label: definition.label,
      defaultRoute: definition.buildRoute(workspace.slug),
      apps: definition.apps,
    });
  });

  return {
    businessId: workspace.businessId,
    sections,
    meta: {
      slug: workspace.slug,
      label: workspace.label,
    },
  } satisfies WorkspaceSections;
}

function dedupeByBusinessId(entries: LoyaltyMembership[]): LoyaltyMembership[] {
  const seen = new Set<string>();
  const result: LoyaltyMembership[] = [];
  for (const entry of entries) {
    if (!entry.businessId || seen.has(entry.businessId)) {
      continue;
    }
    seen.add(entry.businessId);
    result.push(entry);
  }
  return result;
}

function sortByLabel<T extends { label: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.label.localeCompare(b.label));
}

function buildHomeTiles(
  workspaces: WorkspaceSections[],
  gmAccess: boolean,
  loyalties: LoyaltyMembership[],
  inboxUnreadCount: number,
  marketplaceEligible: boolean,
): HomeTile[] {
  const tiles: HomeTile[] = [];

  const workspaceTiles: HomeTile[] = workspaces.map((workspace) => ({
    kind: "workspace",
    businessId: workspace.businessId,
    label: workspace.meta?.label ?? workspace.businessId,
  }));

  tiles.push(...workspaceTiles);

  if (gmAccess) {
    tiles.push({ kind: "gm-console", label: "GM Console" });
  }

  const loyaltyTiles = dedupeByBusinessId(loyalties).map((loyalty) => ({
    kind: "loyalty-pass" as const,
    businessId: loyalty.businessId,
    label: loyalty.label,
  }));
  tiles.push(...sortByLabel(loyaltyTiles));

  if (inboxUnreadCount > 0) {
    tiles.push({ kind: "inbox", label: inboxUnreadCount === 1 ? "Inbox (1)" : `Inbox (${inboxUnreadCount})` });
  }

  if (marketplaceEligible) {
    tiles.push({ kind: "marketplace", label: "Marketplace" });
  }

  if (tiles.length <= HOME_TILE_LIMIT) {
    return tiles;
  }

  return tiles.slice(0, HOME_TILE_LIMIT);
}

function buildEnabledAppSet(
  workspaces: WorkspaceSections[],
  tileAssignments: TileAssignment[],
): Set<string> {
  const enabled = new Set<string>();
  for (const workspace of workspaces) {
    for (const section of workspace.sections) {
      for (const app of section.apps ?? []) {
        enabled.add(app);
      }
    }
  }
  for (const assignment of tileAssignments) {
    if (assignment.visible && assignment.appKey) {
      enabled.add(assignment.appKey);
    }
  }
  return enabled;
}

function roleRankForUser(
  workspaces: WorkspaceDescriptor[],
  loyalties: LoyaltyMembership[],
  gmAccess: boolean,
): number {
  if (gmAccess) {
    return MIN_ROLE_RANK.gm;
  }

  let rank = loyalties.length > 0 ? MIN_ROLE_RANK.customer : 0;

  for (const workspace of workspaces) {
    const role = highestWorkspaceRole(workspace.roles);
    if (role === "owner") {
      rank = Math.max(rank, MIN_ROLE_RANK.owner);
    } else if (role === "manager" || role === "staff") {
      rank = Math.max(rank, MIN_ROLE_RANK.employee);
    }
  }

  return rank;
}

function evaluateAppVisibility(
  app: AppCatalogEntry,
  rules: AppVisibilityRule[],
  userRoleRank: number,
  policyKeys: Set<string>,
  enabledApps: Set<string>,
): MarketplaceItem | null {
  const applicableRules = rules.filter((rule) => rule.appKey === app.key);

  let reason: string | undefined;
  if (applicableRules.length > 0) {
    for (const rule of applicableRules) {
      if (rule.minRole) {
        const requiredRank = MIN_ROLE_RANK[rule.minRole];
        if (userRoleRank < requiredRank) {
          reason = rule.minRole === "gm" ? "Requires Game Master" : `Requires ${rule.minRole.charAt(0).toUpperCase()}${rule.minRole.slice(1)}`;
          break;
        }
      }
      const missingPolicies = (rule.requirePolicies ?? []).filter((policy) => !policyKeys.has(policy));
      if (missingPolicies.length > 0) {
        reason = `Requires ${missingPolicies[0]}`;
        break;
      }
    }
  }

  if (!reason && enabledApps.has(app.key)) {
    return null;
  }

  return {
    appKey: app.key,
    name: app.name,
    reason,
  } satisfies MarketplaceItem;
}

function buildMarketplace(
  apps: AppCatalogEntry[],
  visibilityRules: AppVisibilityRule[],
  userRoleRank: number,
  policyKeys: Set<string>,
  enabledApps: Set<string>,
): { payload: { categories: MarketplaceCategory[] } | undefined; hasEligible: boolean } {
  const categories = new Map<MarketplaceCategoryKey, MarketplaceItem[]>();
  let hasEligible = false;

  for (const app of apps) {
    const categoryKey = normalizeCategory(app.category);
    const item = evaluateAppVisibility(app, visibilityRules, userRoleRank, policyKeys, enabledApps);
    if (!item) {
      continue;
    }
    if (!item.reason) {
      hasEligible = true;
    }
    if (!categories.has(categoryKey)) {
      categories.set(categoryKey, []);
    }
    categories.get(categoryKey)!.push(item);
  }

  const orderedCategories: MarketplaceCategory[] = [];
  for (const key of MARKETPLACE_CATEGORY_ORDER) {
    const items = categories.get(key);
    if (!items || items.length === 0) {
      continue;
    }
    orderedCategories.push({
      key,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return {
    payload: orderedCategories.length > 0 ? { categories: orderedCategories } : undefined,
    hasEligible,
  };
}

export function buildTilesResponse(input: BuildTilesInput): TilesMeResponse {
  const policyKeys = new Set(input.policies);

  const sortedWorkspaces = sortByLabel(input.workspaces);
  const sections = sortedWorkspaces.map((workspace) => buildSectionsForWorkspace(workspace, policyKeys));

  const enabledApps = buildEnabledAppSet(sections, input.tileAssignments);
  const userRoleRank = roleRankForUser(input.workspaces, input.loyalties, input.gmAccess);

  const { payload: marketplacePayload, hasEligible } = buildMarketplace(
    input.apps,
    input.visibilityRules,
    userRoleRank,
    policyKeys,
    enabledApps,
  );

  const hasDiscoverPolicy = input.policies.some((policy) => policy.startsWith("apps."));
  const marketplaceEligible = Boolean(hasDiscoverPolicy && hasEligible);

  const homeTiles = buildHomeTiles(
    sections,
    input.gmAccess,
    sortByLabel(input.loyalties),
    input.inboxUnreadCount,
    marketplaceEligible,
  );

  const response: TilesMeResponse = {
    home: homeTiles,
    workspaces: sections,
  };

  if (hasDiscoverPolicy && marketplacePayload) {
    response.marketplace = marketplacePayload;
  }

  return response;
}
