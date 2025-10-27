"use client";

import { createContext, useContext, type ReactNode } from "react";

import { emptyRoleAssignments, type RoleAssignments } from "@/lib/authz";

const UserRolesContext = createContext<RoleAssignments>(emptyRoleAssignments());

type UserRolesProviderProps = {
  value: RoleAssignments;
  children: ReactNode;
};

export function UserRolesProvider({ value, children }: UserRolesProviderProps) {
  return <UserRolesContext.Provider value={value}>{children}</UserRolesContext.Provider>;
}

export function useUserRoles(): RoleAssignments {
  return useContext(UserRolesContext);
}
