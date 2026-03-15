import type { PolicyRecord, PolicyRequest } from "@/lib/policy/types";
import { permissionSetAllows } from "@/lib/policy/matcher";

const DEV_OVERRIDE_PERMISSIONS: PolicyRecord[] = [
  {
    id: "dev-override",
    key: "dev-override",
    action: "*",
    resource: "*",
  },
];

export enum AppFeature {
  ALLIANCES = "alliances",
  GUILDS = "guilds",
  TEAM = "team",
  HR = "hr",
  SHIFTS = "shifts",
  PAYROLL = "payroll",
  DTR_BULK = "dtr-bulk",
  POS = "pos",
  ALLIANCE_PASS = "alliance-pass",
  IMPORT_CSV = "import-csv",
  SETTINGS = "settings",
}

const FEATURE_DEFINITIONS: Partial<Record<AppFeature, PolicyRequest[]>> = {
  [AppFeature.ALLIANCES]: [
    { action: "tiles:read", resource: "alliances" },
    { action: "apps:discover", resource: "alliances" },
  ],
  [AppFeature.GUILDS]: [
    { action: "tiles:read", resource: "guilds" },
    { action: "apps:discover", resource: "guilds" },
  ],
  [AppFeature.TEAM]: [
    { action: "tiles:read", resource: "team" },
    { action: "apps:discover", resource: "team" },
  ],
  [AppFeature.HR]: [
    { action: "tiles:read", resource: "hr" },
    { action: "apps:discover", resource: "hr" },
  ],
  [AppFeature.SHIFTS]: [
    { action: "tiles:read", resource: "shifts" },
    { action: "apps:discover", resource: "shifts" },
  ],
  [AppFeature.PAYROLL]: [
    { action: "tiles:read", resource: "payroll" },
    { action: "apps:discover", resource: "payroll" },
    { action: "payroll:*", resource: "*" },
  ],
  [AppFeature.DTR_BULK]: [
    { action: "tiles:read", resource: "dtr-bulk" },
    { action: "apps:discover", resource: "dtr-bulk" },
  ],
  [AppFeature.POS]: [
    { action: "tiles:read", resource: "pos" },
    { action: "apps:discover", resource: "pos" },
  ],
  [AppFeature.ALLIANCE_PASS]: [
    { action: "tiles:read", resource: "alliance-pass" },
    { action: "apps:discover", resource: "alliance-pass" },
  ],
  [AppFeature.IMPORT_CSV]: [
    { action: "tiles:read", resource: "import-csv" },
    { action: "apps:discover", resource: "import-csv" },
  ],
  [AppFeature.SETTINGS]: [
    { action: "tiles:read", resource: "settings" },
    { action: "apps:discover", resource: "settings" },
  ],
};

export type FeatureInput = AppFeature | Iterable<AppFeature>;

function isNonProductionEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && nodeEnv !== "production") {
    return true;
  }

  const publicEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (publicEnv && publicEnv !== "production") {
    return true;
  }

  return false;
}

export function shouldBypassPermissions(): boolean {
  // In non-production, developers can explore all modules even while role
  // policies are still being seeded. Explicit feature toggles still win.
  return isNonProductionEnvironment();
}

export function applyDevPermissionsOverride(
  permissions: PolicyRecord[],
): PolicyRecord[] {
  if (!isNonProductionEnvironment()) {
    return permissions;
  }

  const existing = new Set(permissions.map((p) => p.id));
  const merged = [...permissions];

  for (const record of DEV_OVERRIDE_PERMISSIONS) {
    if (!existing.has(record.id)) {
      merged.push(record);
    }
  }

  return merged;
}

function toArray(input: FeatureInput): AppFeature[] {
  if (typeof input === "string") {
    return [input as AppFeature];
  }

  if (Symbol.iterator in Object(input)) {
    return Array.from(input as Iterable<AppFeature>);
  }

  return [];
}

export function canAccess(features: FeatureInput, permissions: PolicyRecord[]): boolean {
  const list = toArray(features);
  if (list.length === 0) {
    return true;
  }

  const effectivePermissions = applyDevPermissionsOverride(permissions);

  return list.every((feature) => {
    const requirements = FEATURE_DEFINITIONS[feature];
    if (!requirements || requirements.length === 0) {
      return true;
    }

    return requirements.some((requirement) =>
      permissionSetAllows(effectivePermissions, requirement),
    );
  });
}

export function canAccessAny(features: FeatureInput, permissions: PolicyRecord[]): boolean {
  const list = toArray(features);
  if (list.length === 0) {
    return true;
  }

  const effectivePermissions = applyDevPermissionsOverride(permissions);

  return list.some((feature) => {
    const requirements = FEATURE_DEFINITIONS[feature];
    if (!requirements || requirements.length === 0) {
      return true;
    }

    return requirements.some((requirement) =>
      permissionSetAllows(effectivePermissions, requirement),
    );
  });
}

export function resolveAccessibleFeatures(
  features: FeatureInput,
  permissions: PolicyRecord[],
): AppFeature[] {
  const list = toArray(features);
  if (list.length === 0) {
    return [];
  }

  return list.filter((feature) => canAccess(feature, permissions));
}

export function requiredPoliciesFor(feature: AppFeature): PolicyRequest[] {
  const requirements = FEATURE_DEFINITIONS[feature];
  return requirements ? requirements.slice() : [];
}
