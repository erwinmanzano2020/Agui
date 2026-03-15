import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentEntityAndPolicies } from "@/lib/policy/server";
import { isOptionalTableError } from "@/lib/supabase/errors";
import { normalizeWorkspaceRole, workspaceRoleAllowsPos } from "@/lib/workspaces/roles";

const POS_POLICY_KEYS = new Set(["tiles.pos.read", "tiles.cashiering.read"]);

export type PosAccessDecision = {
  allowed: boolean;
  allowedByRole: boolean;
  allowedByPolicy: boolean;
  roles: string[];
  normalizedRoles: ReturnType<typeof normalizeWorkspaceRole>[];
  policyKeys: string[];
  entityId: string | null;
};

export function evaluatePosAccess(input: {
  roles: string[];
  policyKeys: Iterable<string>;
  entityId: string | null;
}): PosAccessDecision {
  const normalizedRoles = input.roles.map((role) => normalizeWorkspaceRole(role));
  const allowedByRole = normalizedRoles.some((role) => workspaceRoleAllowsPos(role));

  const policyKeys = Array.from(input.policyKeys ?? []);
  const allowedByPolicy = policyKeys.some((key) => POS_POLICY_KEYS.has(key));

  return {
    allowed: allowedByRole || allowedByPolicy,
    allowedByRole,
    allowedByPolicy,
    roles: input.roles,
    normalizedRoles,
    policyKeys,
    entityId: input.entityId,
  } satisfies PosAccessDecision;
}

export async function requirePosAccess(
  supabase: SupabaseClient,
  houseId: string,
  options?: { dest?: string },
): Promise<PosAccessDecision> {
  const authz = await getCurrentEntityAndPolicies(supabase, { context: "pos", debug: false });
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
        console.warn("Failed to load house roles for POS access", error);
      }
    } else {
      roles = (data ?? [])
        .map((row) => {
          const value = (row as { role?: string | null }).role;
          return typeof value === "string" ? value : null;
        })
        .filter((role): role is string => Boolean(role));
    }

    console.info("[pos-access] resolved roles", { houseId, entityId, roles });
  }

  const decision = evaluatePosAccess({ roles, policyKeys: authz.policyKeys, entityId });
  if (!decision.allowed) {
    const dest = options?.dest && options.dest.startsWith("/") ? options.dest : "/403";
    console.info("[pos-access] denying entry", {
      houseId,
      entityId,
      roles: decision.normalizedRoles,
      policyKeys: decision.policyKeys,
      allowedByRole: decision.allowedByRole,
      allowedByPolicy: decision.allowedByPolicy,
    });
    const params = new URLSearchParams({ dest });
    redirect(`/403?${params.toString()}`);
  }

  return decision;
}
