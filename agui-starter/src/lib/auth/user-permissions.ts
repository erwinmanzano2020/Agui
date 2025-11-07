import "server-only";

import { cache } from "react";

import { listPoliciesForCurrentUser } from "@/lib/policy/server";
import type { PolicyRecord } from "@/lib/policy/types";

export type UserPermissions = PolicyRecord[];

export const getUserPermissions = cache(async (): Promise<UserPermissions> => {
  try {
    return await listPoliciesForCurrentUser();
  } catch (error) {
    console.warn("Failed to resolve user permissions", error);
    return [];
  }
});
