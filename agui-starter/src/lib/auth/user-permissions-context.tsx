"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { PolicyRecord } from "@/lib/policy/types";
import { useSession, type ViewAsSelection } from "@/lib/auth/session-context";
import { applyDevPermissionsOverride } from "@/lib/auth/permissions";

const UserPermissionsContext = createContext<PolicyRecord[]>([]);

type UserPermissionsProviderProps = {
  value: PolicyRecord[];
  children: ReactNode;
};

export function UserPermissionsProvider({ value, children }: UserPermissionsProviderProps) {
  const memoValue = useMemo(() => value.slice(), [value]);
  return (
    <UserPermissionsContext.Provider value={memoValue}>
      {children}
    </UserPermissionsContext.Provider>
  );
}

export function useActualUserPermissions(): PolicyRecord[] {
  return useContext(UserPermissionsContext);
}

type CatalogRow = {
  policy_id: string;
  policy_key: string;
  action: string;
  resource: string;
  scope: ViewAsSelection["scope"];
  role_slug: string;
  scope_ref: string | null;
};

function filterRowsForSelection(rows: CatalogRow[], selection: ViewAsSelection): CatalogRow[] {
  if (selection.scope === "GUILD") {
    if (!selection.guildId) return rows;
    return rows.filter((row) => !row.scope_ref || row.scope_ref === selection.guildId);
  }

  if (selection.scope === "HOUSE") {
    if (!selection.houseId) return rows;
    return rows.filter((row) => !row.scope_ref || row.scope_ref === selection.houseId);
  }

  return rows;
}

export function useUserPermissions(): PolicyRecord[] {
  const base = useActualUserPermissions();
  const { supabase, viewAs } = useSession();
  const [simulated, setSimulated] = useState<PolicyRecord[] | null>(null);

  useEffect(() => {
    if (!supabase || !viewAs) {
      setSimulated(null);
      return;
    }

    const roles = viewAs.roles ?? [];
    if (roles.length === 0) {
      setSimulated([]);
      return;
    }

    let cancelled = false;
    const fetchPolicies = async () => {
      const { data, error } = await supabase
        .from("role_policy_catalog")
        .select("policy_id, policy_key, action, resource, scope, role_slug, scope_ref")
        .eq("scope", viewAs.scope)
        .in("role_slug", roles);

      if (error) {
        console.warn("Failed to load simulated permissions", error);
        if (!cancelled) {
          setSimulated([]);
        }
        return;
      }

      const filtered = filterRowsForSelection((data as CatalogRow[]) ?? [], viewAs);
      const map = new Map<string, PolicyRecord>();
      for (const row of filtered) {
        if (!row?.policy_id) continue;
        if (!map.has(row.policy_id)) {
          map.set(row.policy_id, {
            id: row.policy_id,
            key: row.policy_key,
            action: row.action,
            resource: row.resource,
          });
        }
      }

      if (!cancelled) {
        setSimulated(Array.from(map.values()));
      }
    };

    fetchPolicies().catch((error) => {
      console.warn("Failed to simulate permissions", error);
      if (!cancelled) {
        setSimulated([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, viewAs]);

  if (simulated === null) {
    return applyDevPermissionsOverride(base);
  }

  return applyDevPermissionsOverride(simulated);
}
