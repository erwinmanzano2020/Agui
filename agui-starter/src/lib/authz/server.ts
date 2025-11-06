import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  getMyEntityId as getMyEntityIdFromClient,
  getMyRoles as getMyRolesFromClient,
  hasRoleInAssignments,
  type RoleAssignments,
  type RoleScope,
} from "../authz";
import {
  evaluatePolicy,
  listPoliciesForCurrentUser,
} from "@/lib/policy/server";
import type { PolicyRecord, PolicyRequest } from "@/lib/policy/types";

export async function getMyRoles(
  client?: SupabaseClient | null,
): Promise<RoleAssignments> {
  const supabase = client ?? (await createServerSupabaseClient());
  return getMyRolesFromClient(supabase);
}

export async function hasRole(
  scope: RoleScope,
  role: string,
  client?: SupabaseClient | null,
): Promise<boolean> {
  const roles = await getMyRoles(client);
  return hasRoleInAssignments(roles, scope, role);
}

export async function getMyEntityId(
  client?: SupabaseClient | null,
): Promise<string | null> {
  const supabase = client ?? (await createServerSupabaseClient());
  return getMyEntityIdFromClient(supabase);
}

export async function listMyPolicies(
  client?: SupabaseClient | null,
): Promise<PolicyRecord[]> {
  const supabase = client ?? (await createServerSupabaseClient());
  return listPoliciesForCurrentUser(supabase);
}

export async function evaluatePolicyForCurrentUser(
  request: PolicyRequest,
  client?: SupabaseClient | null,
): Promise<boolean> {
  const supabase = client ?? (await createServerSupabaseClient());
  return evaluatePolicy(request, supabase);
}

export {
  emptyRoleAssignments,
  hasRoleInAssignments,
  isRoleAssignmentsEmpty,
} from "../authz";
export type { RoleAssignments, RoleScope } from "../authz";
export type { PolicyRecord, PolicyRequest } from "@/lib/policy/types";
export { isGM } from "@/lib/identity/entity";
