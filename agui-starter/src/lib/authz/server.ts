import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  canWithRoles,
  getMyRoles as getMyRolesFromClient,
  hasRoleInAssignments,
  type Feature,
  type RoleAssignments,
  type RoleScope,
} from "../authz";

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

export async function can(
  feature: Feature,
  client?: SupabaseClient | null,
): Promise<boolean> {
  const roles = await getMyRoles(client);
  return canWithRoles(roles, feature);
}

export {
  canWithRoles,
  emptyRoleAssignments,
  hasRoleInAssignments,
  isRoleAssignmentsEmpty,
  FEATURE_ROLES,
} from "../authz";
export type { Feature, RoleAssignments, RoleScope } from "../authz";
export { isGM } from "@/lib/identity/entity";
