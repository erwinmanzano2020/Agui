"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { emptyRoleAssignments, type RoleAssignments } from "@/lib/authz";
import { useSession, type ViewAsSelection } from "@/lib/auth/session-context";

const UserRolesContext = createContext<RoleAssignments>(emptyRoleAssignments());

type UserRolesProviderProps = {
  value: RoleAssignments;
  children: ReactNode;
};

export function UserRolesProvider({ value, children }: UserRolesProviderProps) {
  return <UserRolesContext.Provider value={value}>{children}</UserRolesContext.Provider>;
}

export function useActualUserRoles(): RoleAssignments {
  return useContext(UserRolesContext);
}

function toUniqueRoles(selection: ViewAsSelection | null): RoleAssignments | null {
  if (!selection) {
    return null;
  }

  const unique = Array.from(
    new Set((selection.roles ?? []).filter((role): role is string => typeof role === "string" && role.trim())),
  );

  const viewRoles = emptyRoleAssignments();
  if (selection.scope === "GUILD") {
    viewRoles.GUILD = unique;
  } else if (selection.scope === "HOUSE") {
    viewRoles.HOUSE = unique;
  }

  return viewRoles;
}

export function useUserRoles(): RoleAssignments {
  const baseRoles = useActualUserRoles();
  const { viewAs } = useSession();

  return useMemo(() => {
    const simulated = toUniqueRoles(viewAs);
    if (!simulated) {
      return baseRoles;
    }
    return simulated;
  }, [baseRoles, viewAs]);
}
