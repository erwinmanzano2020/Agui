import "server-only";

import type { RoleAssignments, RoleScope } from "@/lib/authz";
import { getCurrentEntityAndPolicies } from "@/lib/policy/server";
import { getUserPermissions } from "@/lib/auth/user-permissions";
import { getUserRoles } from "@/lib/auth/user-roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PolicyRecord } from "@/lib/policy/types";

import { SCOPE_TO_ROLE_SCOPE, type ScopeType } from "./access-definitions";

export type ResolveAccessContextInput = {
  userId?: string | null;
  scopeType: ScopeType;
  scopeId?: string | null;
};

export type AccessMembership = {
  isMember: boolean;
  roleCount: number;
  scopeRoleScope: RoleScope;
};

export type AccessElevatedAuthority = {
  hasOperationalElevatedAuthority: boolean;
  sourceRole: "game_master" | null;
};

export type AccessContext = {
  userId: string | null;
  scopeType: ScopeType;
  scopeId: string | null;
  roles: RoleAssignments;
  permissions: PolicyRecord[];
  membership: AccessMembership;
  elevatedAuthority: AccessElevatedAuthority;
};

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.warn("[access-resolver] Failed to resolve current user", error);
      return null;
    }

    return user?.id ?? null;
  } catch (error) {
    console.warn("[access-resolver] Unexpected error resolving current user", error);
    return null;
  }
}

function resolveMembership(roles: RoleAssignments, scopeType: ScopeType): AccessMembership {
  const scopeRoleScope = SCOPE_TO_ROLE_SCOPE[scopeType];
  const scopedRoles = roles[scopeRoleScope] ?? [];

  return {
    isMember: scopedRoles.length > 0,
    roleCount: scopedRoles.length,
    scopeRoleScope,
  } satisfies AccessMembership;
}

function resolveElevatedAuthority(roles: RoleAssignments): AccessElevatedAuthority {
  const hasOperationalElevatedAuthority = roles.PLATFORM.includes("game_master");

  return {
    hasOperationalElevatedAuthority,
    sourceRole: hasOperationalElevatedAuthority ? "game_master" : null,
  } satisfies AccessElevatedAuthority;
}

export async function resolveAccessContext(
  input: ResolveAccessContextInput,
): Promise<AccessContext> {
  const [roles, permissions, authz] = await Promise.all([
    getUserRoles(),
    getUserPermissions(),
    getCurrentEntityAndPolicies(undefined, { context: "access-resolver", debug: false }),
  ]);

  const elevatedAuthority = resolveElevatedAuthority(roles);
  const membership = resolveMembership(roles, input.scopeType);

  const resolvedUserId = input.userId ?? (await resolveCurrentUserId()) ?? authz.entityId;

  return {
    userId: resolvedUserId,
    scopeType: input.scopeType,
    scopeId: input.scopeId ?? null,
    roles,
    permissions,
    membership,
    elevatedAuthority,
  } satisfies AccessContext;
}
