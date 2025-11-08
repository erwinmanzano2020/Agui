export type HomeTile =
  | { kind: "loyalty-pass"; businessId: string; label: string }
  | { kind: "workspace"; businessId: string; label: string }
  | { kind: "inbox"; label: string }
  | { kind: "marketplace"; label: string }
  | { kind: "start-business"; label: string }
  | { kind: "gm-console"; label: string };

export type WorkspaceSectionKey = "overview" | "people" | "operations" | "finance" | "settings";

export type WorkspaceSection = {
  key: WorkspaceSectionKey;
  label: string;
  badges?: Array<{ key: string; value: number | string }>;
  defaultRoute: string;
  apps?: string[];
};

export type WorkspaceSections = {
  businessId: string;
  sections: WorkspaceSection[];
  meta?: {
    slug?: string | null;
    label?: string;
  };
};

export type MarketplaceItem = {
  appKey: string;
  name: string;
  reason?: string;
};

export type MarketplaceCategoryKey = "People" | "Operations" | "Finance" | "Tools";

export type MarketplaceCategory = {
  key: MarketplaceCategoryKey;
  items: MarketplaceItem[];
};

export type MarketplacePayload = {
  categories: MarketplaceCategory[];
};

export type TilesMeResponse = {
  home: HomeTile[];
  workspaces: WorkspaceSections[];
  marketplace?: MarketplacePayload;
};

export type TileAssignment = {
  appKey: string;
  businessId?: string | null;
  visible: boolean;
};

export type LoyaltyMembership = {
  businessId: string;
  label: string;
};

export type WorkspaceRole = "owner" | "manager" | "staff" | "guest";

export type WorkspaceDescriptor = {
  businessId: string;
  label: string;
  slug: string | null;
  roles: WorkspaceRole[];
  enabledApps: string[];
  badges?: Array<{ key: string; value: number | string }>;
};

export type AppCatalogEntry = {
  key: string;
  name: string;
  category: string;
  tags: string[];
};

export type AppVisibilityRule = {
  appKey: string;
  minRole?: "customer" | "employee" | "owner" | "gm";
  requirePolicies: string[];
};

export type BuildTilesInput = {
  loyalties: LoyaltyMembership[];
  workspaces: WorkspaceDescriptor[];
  tileAssignments: TileAssignment[];
  policies: string[];
  gmAccess: boolean;
  inboxUnreadCount: number;
  apps: AppCatalogEntry[];
  visibilityRules: AppVisibilityRule[];
};
