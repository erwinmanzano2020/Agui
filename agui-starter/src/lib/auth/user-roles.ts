import "server-only";

import { cache } from "react";

import { emptyRoleAssignments, type RoleAssignments } from "@/lib/authz";
import { getMyRoles } from "@/lib/authz/server";

export type UserRoles = RoleAssignments;

export const getUserRoles = cache(async (): Promise<UserRoles> => {
  try {
    return await getMyRoles();
  } catch (error) {
    console.warn("Failed to resolve user roles", error);
    return emptyRoleAssignments();
  }
});
