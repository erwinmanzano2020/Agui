import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { getMyEntityId } from "@/lib/authz";
import { permissionSetAllows } from "./matcher";
import type { PolicyRecord, PolicyRequest } from "./types";

function dedupePolicies(rows: PolicyRecord[]): PolicyRecord[] {
  const seen = new Map<string, PolicyRecord>();
  for (const row of rows) {
    if (!row?.id) continue;
    if (!seen.has(row.id)) {
      seen.set(row.id, row);
    }
  }
  return Array.from(seen.values());
}

async function listPoliciesForEntity(
  client: SupabaseClient,
  entityId: string,
): Promise<PolicyRecord[]> {
  const { data, error } = await client
    .from("entity_policies")
    .select("policy_id, action, resource, policy:policies(key)")
    .eq("entity_id", entityId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) => {
    const id = typeof (row as { policy_id?: unknown }).policy_id === "string" ? (row as { policy_id: string }).policy_id : "";
    const key = (() => {
      const withAlias = (row as { policy_key?: unknown }).policy_key;
      if (typeof withAlias === "string" && withAlias.trim().length > 0) {
        return withAlias.trim();
      }
      const directKey = (row as { key?: unknown }).key;
      if (typeof directKey === "string" && directKey.trim().length > 0) {
        return directKey.trim();
      }
      const nested = (row as { policy?: unknown }).policy;
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        const nestedKey = (nested as { key?: unknown }).key;
        if (typeof nestedKey === "string" && nestedKey.trim().length > 0) {
          return nestedKey.trim();
        }
      }
      return "";
    })();
    const action = typeof (row as { action?: unknown }).action === "string" ? (row as { action: string }).action : "";
    const resource =
      typeof (row as { resource?: unknown }).resource === "string" ? (row as { resource: string }).resource : "";

    return {
      id,
      key,
      action,
      resource,
    } satisfies PolicyRecord;
  });

  const missingKeyPolicyIds = rows.filter((row) => row.id && !row.key).map((row) => row.id);
  if (missingKeyPolicyIds.length > 0) {
    const { data: policyRows, error: policyError } = await client
      .from("policies")
      .select("id, key")
      .in("id", missingKeyPolicyIds);

    if (policyError) {
      throw new Error(policyError.message);
    }

    const keyById = new Map<string, string>();
    for (const row of policyRows ?? []) {
      const id = typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id : "";
      const key = typeof (row as { key?: unknown }).key === "string" ? (row as { key: string }).key : "";
      if (id && key) {
        keyById.set(id, key);
      }
    }

    for (const row of rows) {
      if (!row.key && row.id && keyById.has(row.id)) {
        row.key = keyById.get(row.id) ?? "";
      }
    }
  }

  return dedupePolicies(rows.filter((row) => row.id && row.key));
}

export type CurrentEntityPolicies = {
  entityId: string | null;
  policies: PolicyRecord[];
  policyKeys: string[];
  source: string | null;
  error?: string | null;
  policyError?: string | null;
};

function logAuthzDebug(context: string, payload: CurrentEntityPolicies) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const prefix = context ? `[authz:${context}]` : "[authz]";
  console.debug(prefix, {
    entityId: payload.entityId,
    policyKeys: payload.policyKeys,
    source: payload.source,
    error: payload.error,
    policyError: payload.policyError,
  });
}

function extractPolicyKeys(policies: PolicyRecord[]): string[] {
  const keys = new Set<string>();
  for (const policy of policies) {
    if (typeof policy?.key === "string" && policy.key.trim().length > 0) {
      keys.add(policy.key.trim());
    }
  }
  return Array.from(keys.values());
}

type PolicyHydrationResult = { policies: PolicyRecord[]; error: string | null };

async function fetchPoliciesWithFallback(
  entityId: string,
  primary: SupabaseClient,
  fallback: SupabaseClient | null,
): Promise<PolicyHydrationResult> {
  const errors: string[] = [];
  const clients: SupabaseClient[] = [primary];
  if (fallback && fallback !== primary) {
    clients.push(fallback);
  }

  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index];
    try {
      const policies = await listPoliciesForEntity(client, entityId);
      if (policies.length > 0 || index === clients.length - 1) {
        return { policies, error: errors.length > 0 ? errors.join("; ") : null };
      }
      errors.push("no policies returned by primary client; retried with fallback");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
    }
  }

  return { policies: [], error: errors.length > 0 ? errors.join("; ") : null };
}

export async function getCurrentEntityAndPolicies(
  client?: SupabaseClient | null,
  options?: { context?: string; debug?: boolean; lookupClient?: SupabaseClient; policyFallbackClient?: SupabaseClient },
): Promise<CurrentEntityPolicies> {
  const supabase = client ?? (await createServerSupabaseClient());
  let lookup = options?.lookupClient ?? null;
  if (!lookup) {
    try {
      lookup = getServiceSupabase();
    } catch (error) {
      console.warn("Falling back to session client for entity lookup", error);
    }
  }

  let resolutionSource: string | null = null;
  let resolutionError: string | null = null;
  const entityId = await getMyEntityId(supabase, {
    lookupClient: lookup ?? supabase,
    report: (details) => {
      resolutionSource = details.source ?? null;
      resolutionError = details.error ?? null;
    },
  });
  if (!entityId) {
    const result: CurrentEntityPolicies = {
      entityId: null,
      policies: [],
      policyKeys: [],
      source: resolutionSource,
      error: resolutionError,
    };
    if (options?.debug ?? true) {
      logAuthzDebug(options?.context ?? "current", result);
    }
    return result;
  }

  const policyClient = lookup ?? supabase;
  let serviceFallback: SupabaseClient | null = options?.policyFallbackClient ?? null;
  if (!serviceFallback) {
    try {
      serviceFallback = getServiceSupabase();
    } catch (error) {
      if (policyClient !== supabase) {
        console.warn("Service fallback unavailable for policy hydration", error);
      }
    }
  }

  try {
    const { policies, error: policyError } = await fetchPoliciesWithFallback(
      entityId,
      policyClient,
      serviceFallback,
    );
    const result: CurrentEntityPolicies = {
      entityId,
      policies,
      policyKeys: extractPolicyKeys(policies),
      source: resolutionSource,
      error: [resolutionError, policyError ? `policy error: ${policyError}` : null]
        .filter(Boolean)
        .join("; ") || null,
      policyError: policyError ?? null,
    };
    if (options?.debug ?? true) {
      logAuthzDebug(options?.context ?? "current", result);
    }
    return result;
  } catch (error) {
    console.warn("Failed to load policies for entity", error);
    const result: CurrentEntityPolicies = {
      entityId,
      policies: [],
      policyKeys: [],
      source: resolutionSource,
      error:
        [
          resolutionError,
          error instanceof Error ? `policy error: ${error.message}` : String(error ?? ""),
        ]
          .filter(Boolean)
          .join("; ") || null,
      policyError: error instanceof Error ? error.message : String(error ?? ""),
    };
    if (options?.debug ?? true) {
      logAuthzDebug(options?.context ?? "current", result);
    }
    return result;
  }
}

export async function listPoliciesForCurrentUser(
  client?: SupabaseClient | null,
  options?: { lookupClient?: SupabaseClient },
): Promise<PolicyRecord[]> {
  const { policies } = await getCurrentEntityAndPolicies(client ?? null, {
    context: "listPoliciesForCurrentUser",
    debug: false,
    lookupClient: options?.lookupClient,
  });
  return policies;
}

export async function evaluatePolicy(
  request: PolicyRequest,
  client?: SupabaseClient | null,
): Promise<boolean> {
  const policies = await listPoliciesForCurrentUser(client ?? null);
  return permissionSetAllows(policies, request);
}

export function evaluatePolicyFromSet(
  policies: PolicyRecord[] | null | undefined,
  request: PolicyRequest,
): boolean {
  return permissionSetAllows(policies, request);
}
