import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentEntityAndPolicies } from "@/lib/policy/server";
import { isOptionalTableError } from "@/lib/supabase/errors";
import { normalizeWorkspaceRole } from "@/lib/workspaces/roles";

const HR_POLICY_KEYS = new Set(["tiles.hr.read", "tiles.payroll.read"]);

export type HrAccessDecision = {
  allowed: boolean;
  allowedByRole: boolean;
  allowedByPolicy: boolean;
  roles: string[];
  normalizedRoles: ReturnType<typeof normalizeWorkspaceRole>[];
  policyKeys: string[];
  entityId: string | null;
};

export function evaluateHrAccess(input: {
  roles: string[];
  policyKeys: Iterable<string>;
  entityId: string | null;
}): HrAccessDecision {
  const normalizedRoles = input.roles.map((role) => normalizeWorkspaceRole(role));
  const allowedByRole = normalizedRoles.some((role) => role === "owner" || role === "manager");

  const policyKeys = Array.from(input.policyKeys ?? []);
  const allowedByPolicy = policyKeys.some((key) => HR_POLICY_KEYS.has(key));

  return {
    allowed: allowedByRole || allowedByPolicy,
    allowedByRole,
    allowedByPolicy,
    roles: input.roles,
    normalizedRoles,
    policyKeys,
    entityId: input.entityId,
  } satisfies HrAccessDecision;
}

export async function resolveHrAccess(
  supabase: SupabaseClient,
  houseId: string,
): Promise<HrAccessDecision & { hasWorkspaceAccess: boolean }> {
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

  const decision = evaluateHrAccess({ roles, policyKeys: authz.policyKeys, entityId });
  const hasWorkspaceAccess = roles.length > 0 || decision.allowedByPolicy;

  return { ...decision, hasWorkspaceAccess };
}
