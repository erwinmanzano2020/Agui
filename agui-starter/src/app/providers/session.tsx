import { type ReactNode } from "react";

import { SessionProvider } from "@/lib/auth/session-context";
import { getUserRoles } from "@/lib/auth/user-roles";
import { UserRolesProvider } from "@/lib/auth/user-roles-context";
import { getUserPermissions } from "@/lib/auth/user-permissions";
import { UserPermissionsProvider } from "@/lib/auth/user-permissions-context";

type SessionProvidersProps = {
  children: ReactNode;
};

export default async function SessionProviders({ children }: SessionProvidersProps) {
  const [roles, permissions] = await Promise.all([getUserRoles(), getUserPermissions()]);

  return (
    <SessionProvider>
      <UserRolesProvider value={roles}>
        <UserPermissionsProvider value={permissions}>{children}</UserPermissionsProvider>
      </UserRolesProvider>
    </SessionProvider>
  );
}
