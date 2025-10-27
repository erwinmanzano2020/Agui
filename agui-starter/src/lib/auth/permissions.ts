import type { RoleAssignments } from "@/lib/authz";
import { hasRoleInAssignments } from "@/lib/authz";

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

type RoleRequirement = {
  scope: keyof RoleAssignments;
  role: string;
};

type FeatureDefinition = {
  requirements: RoleRequirement[];
  predicates: Array<(roles: RoleAssignments) => boolean>;
};

const ROLE = {
  gm: { scope: "PLATFORM" as const, role: "game_master" },
  guildMaster: { scope: "GUILD" as const, role: "guild_master" },
  guildElder: { scope: "GUILD" as const, role: "guild_elder" },
  houseManager: { scope: "HOUSE" as const, role: "house_manager" },
  cashier: { scope: "HOUSE" as const, role: "cashier" },
};

function predicate(requirement: RoleRequirement) {
  return (roles: RoleAssignments) => hasRoleInAssignments(roles, requirement.scope, requirement.role);
}

const FEATURE_DEFINITIONS: Partial<Record<AppFeature, FeatureDefinition>> = {
  [AppFeature.ALLIANCES]: {
    requirements: [ROLE.gm],
    predicates: [predicate(ROLE.gm)],
  },
  [AppFeature.GUILDS]: {
    requirements: [ROLE.guildMaster, ROLE.gm],
    predicates: [predicate(ROLE.guildMaster), predicate(ROLE.gm)],
  },
  [AppFeature.TEAM]: {
    requirements: [ROLE.houseManager],
    predicates: [predicate(ROLE.houseManager)],
  },
  [AppFeature.SHIFTS]: {
    requirements: [ROLE.houseManager],
    predicates: [predicate(ROLE.houseManager)],
  },
  [AppFeature.PAYROLL]: {
    requirements: [ROLE.houseManager],
    predicates: [predicate(ROLE.houseManager)],
  },
  [AppFeature.DTR_BULK]: {
    requirements: [ROLE.houseManager],
    predicates: [predicate(ROLE.houseManager)],
  },
  [AppFeature.POS]: {
    requirements: [ROLE.cashier, ROLE.houseManager],
    predicates: [predicate(ROLE.cashier), predicate(ROLE.houseManager)],
  },
  [AppFeature.ALLIANCE_PASS]: {
    requirements: [ROLE.guildElder, ROLE.gm],
    predicates: [predicate(ROLE.guildElder), predicate(ROLE.gm)],
  },
  [AppFeature.IMPORT_CSV]: {
    requirements: [ROLE.gm],
    predicates: [predicate(ROLE.gm)],
  },
  [AppFeature.SETTINGS]: {
    requirements: [ROLE.gm],
    predicates: [predicate(ROLE.gm)],
  },
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

export function canAccess(features: FeatureInput, roles: RoleAssignments): boolean {
  const list = toArray(features);
  if (list.length === 0) {
    return true;
  }

  return list.every((feature) => {
    const definition = FEATURE_DEFINITIONS[feature];
    if (!definition) {
      return true;
    }

    return definition.predicates.some((predicateFn) => predicateFn(roles));
  });
}

export function requiredRolesFor(feature: AppFeature): RoleRequirement[] {
  const definition = FEATURE_DEFINITIONS[feature];
  return definition?.requirements ?? [];
}

export { type RoleAssignments };
