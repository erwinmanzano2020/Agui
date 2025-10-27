import { type ReactNode } from "react";

import { SessionProvider } from "@/lib/auth/session-context";
import { getUserRoles } from "@/lib/auth/user-roles";
import { UserRolesProvider } from "@/lib/auth/user-roles-context";

type SessionProvidersProps = {
  children: ReactNode;
};

export default async function SessionProviders({ children }: SessionProvidersProps) {
  const roles = await getUserRoles();

  return (
    <SessionProvider>
      <UserRolesProvider value={roles}>{children}</UserRolesProvider>
    </SessionProvider>
  );
}
