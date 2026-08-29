import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentEntityAndPolicies, listPolicyKeysForEntityAtHouse } from "@/lib/policy/server";
import { isOptionalTableError } from "@/lib/supabase/errors";
import { normalizeWorkspaceRole } from "@/lib/workspaces/roles";

const HR_READ_POLICY_KEYS = new Set(["tiles.hr.read", "tiles.payroll.read"]);

export type HrAccessDecision = {
  allowed: boolean;
  allowedByRole: boolean;
  allowedByPolicy: boolean;
  hasWorkspaceAccess: boolean;
  roles: string[];
  normalizedRoles: ReturnType<typeof normalizeWorkspaceRole>[];
  policyKeys: string[];
  entityId: string | null;
  evaluatedHouseId?: string;
  evaluatedLevel?: "read" | "write";
  evaluatedCapability?: "hr" | "payroll";
};

export type HrBranchAccessDecision = HrAccessDecision & {
  branchId: string | null;
  isBranchLimited: boolean;
  allowedBranchIds: string[];
};

export function evaluateHrAccess(input: {
  roles: string[];
  policyKeys: Iterable<string>;
  entityId: string | null;
  requiredLevel?: "read" | "write";
  requiredCapability?: "hr" | "payroll";
}): HrAccessDecision {
  const normalizedRoles = input.roles.map((role) => normalizeWorkspaceRole(role));
  const allowedByRole = normalizedRoles.some((role) => role === "owner" || role === "manager");
  const hasWorkspaceAccess = input.roles.length > 0;

  const policyKeys = Array.from(input.policyKeys ?? []);
  const requiredLevel = input.requiredLevel ?? "read";
  const writePolicyKey = input.requiredCapability === "payroll" ? "domain.payroll.all" : "domain.hr.all";
  const allowedByPolicy = policyKeys.some((key) =>
    requiredLevel === "write" ? key === writePolicyKey : HR_READ_POLICY_KEYS.has(key),
  );

  return {
    allowed: hasWorkspaceAccess && (allowedByRole || allowedByPolicy),
    allowedByRole,
    allowedByPolicy,
    hasWorkspaceAccess,
    roles: input.roles,
    normalizedRoles,
    policyKeys,
    entityId: input.entityId,
  } satisfies HrAccessDecision;
}

export async function resolveHrAccess(
  supabase: SupabaseClient,
  houseId: string,
): Promise<HrAccessDecision> {
  const authz = await getCurrentEntityAndPolicies(supabase, { context: "hr", debug: false });
  const entityId = authz.entityId;

  let roles: string[] = [];
  if (entityId) {
    const { data, error } = await supabase
      .from("house_roles")
      .select("role")
      .eq("house_id", houseId)
      .eq("entity_id", entityId);

    if (error) {
      if (!isOptionalTableError(error)) {
        console.warn("Failed to load house roles for HR access", error);
      }
    } else {
      roles = (data ?? [])
        .map((row) => {
          const value = (row as { role?: string | null }).role;
          return typeof value === "string" ? value : null;
        })
        .filter((role): role is string => Boolean(role));
    }
  }

  return evaluateHrAccess({ roles, policyKeys: authz.policyKeys, entityId });
}

export async function requireHrAccess(
  supabase: SupabaseClient,
  houseId: string,
): Promise<HrAccessDecision> {
  return resolveHrAccess(supabase, houseId);
}

const HR_BRANCH_POLICY_PATTERNS = [
  // UUID-only branch scope keys; keep strict to avoid accepting malformed ids.
  /^hr\.branch\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  /^tiles\.hr\.branch\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  /^hr:branch:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  /^tiles:hr:branch:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
];

function extractBranchScopesFromPolicyKeys(policyKeys: Iterable<string>): string[] {
  const scoped = new Set<string>();
  for (const raw of policyKeys) {
    const key = raw?.trim();
    if (!key) continue;
    for (const pattern of HR_BRANCH_POLICY_PATTERNS) {
      const match = key.match(pattern);
      if (match?.[1]) {
        scoped.add(match[1].toLowerCase());
      }
    }
  }
  return Array.from(scoped.values());
}

export async function requireHrAccessWithBranch(
  supabase: SupabaseClient,
  input: { houseId: string; branchId?: string | null; requiredLevel?: "read" | "write"; requiredCapability?: "hr" | "payroll" },
): Promise<HrBranchAccessDecision> {
  const baseAccess = await requireHrAccess(supabase, input.houseId);
  const requiredLevel = input.requiredLevel ?? "read";
  let policyKeys = baseAccess.policyKeys;
  if (requiredLevel === "write" && baseAccess.entityId && !baseAccess.allowedByRole) {
    try {
      policyKeys = await listPolicyKeysForEntityAtHouse(supabase, baseAccess.entityId, input.houseId);
    } catch (error) {
      console.warn("Failed to load house-scoped HR write policies", error);
      policyKeys = [];
    }
  }
  const access = {
    ...evaluateHrAccess({
      roles: baseAccess.roles,
      policyKeys,
      entityId: baseAccess.entityId,
      requiredLevel,
      requiredCapability: input.requiredCapability,
    }),
    evaluatedHouseId: input.houseId,
    evaluatedLevel: requiredLevel,
    evaluatedCapability: input.requiredCapability ?? "hr",
  };
  const allowedBranchIds = extractBranchScopesFromPolicyKeys(access.policyKeys);
  const isBranchLimited = !access.allowedByRole && allowedBranchIds.length > 0;
  const branchId = input.branchId?.trim().toLowerCase() || null;
  const hasZeroScopeBranchAccess = !access.allowedByRole && access.allowed && allowedBranchIds.length === 0;

  if (!access.allowed) {
    return {
      ...access,
      branchId,
      isBranchLimited,
      allowedBranchIds,
      allowed: false,
    };
  }

  if (hasZeroScopeBranchAccess) {
    return {
      ...access,
      branchId,
      isBranchLimited: true,
      allowedBranchIds,
      allowed: false,
    };
  }

  if (branchId && isBranchLimited && !allowedBranchIds.includes(branchId)) {
    return {
      ...access,
      branchId,
      isBranchLimited,
      allowedBranchIds,
      allowed: false,
    };
  }

  return {
    ...access,
    branchId,
    isBranchLimited,
    allowedBranchIds,
  };
}
