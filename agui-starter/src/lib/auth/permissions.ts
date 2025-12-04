import type { PolicyRecord, PolicyRequest } from "@/lib/policy/types";
import { permissionSetAllows } from "@/lib/policy/matcher";

export enum AppFeature {
  ALLIANCES = "alliances",
  GUILDS = "guilds",
  TEAM = "team",
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

  // Temporary dev override: while policy seeding is incomplete and we run
  // single-tenant, treat an empty permission set as full access so owners are
  // not blocked by missing policies. Remove once real permissions are seeded.
  if (permissions.length === 0) {
    return true;
  }

  return list.every((feature) => {
    const requirements = FEATURE_DEFINITIONS[feature];
    if (!requirements || requirements.length === 0) {
      return true;
    }

    return requirements.some((requirement) =>
      permissionSetAllows(permissions, requirement),
    );
  });
}

export function canAccessAny(features: FeatureInput, permissions: PolicyRecord[]): boolean {
  const list = toArray(features);
  if (list.length === 0) {
    return true;
  }

  // Temporary dev override: allow all features when no policies are returned.
  // This keeps the app usable in dev/single-tenant setups until policy data is
  // seeded consistently across environments.
  if (permissions.length === 0) {
    return true;
  }

  return list.some((feature) => {
    const requirements = FEATURE_DEFINITIONS[feature];
    if (!requirements || requirements.length === 0) {
      return true;
    }

    return requirements.some((requirement) =>
      permissionSetAllows(permissions, requirement),
    );
  });
}

export function requiredPoliciesFor(feature: AppFeature): PolicyRequest[] {
  const requirements = FEATURE_DEFINITIONS[feature];
  return requirements ? requirements.slice() : [];
}
