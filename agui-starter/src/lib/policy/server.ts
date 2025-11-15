import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
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
    .select("policy_id, policy_key, action, resource")
    .eq("entity_id", entityId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) => ({
    id: row.policy_id as string,
    key: row.policy_key as string,
    action: row.action as string,
    resource: row.resource as string,
  } satisfies PolicyRecord));

  return dedupePolicies(rows);
}

export type CurrentEntityPolicies = {
  entityId: string | null;
  policies: PolicyRecord[];
  policyKeys: string[];
};

function logAuthzDebug(context: string, payload: CurrentEntityPolicies) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const prefix = context ? `[authz:${context}]` : "[authz]";
  console.debug(prefix, {
    entityId: payload.entityId,
    policyKeys: payload.policyKeys,
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

export async function getCurrentEntityAndPolicies(
  client?: SupabaseClient | null,
  options?: { context?: string; debug?: boolean },
): Promise<CurrentEntityPolicies> {
  const supabase = client ?? (await createServerSupabaseClient());
  const entityId = await getMyEntityId(supabase);
  if (!entityId) {
    const result: CurrentEntityPolicies = { entityId: null, policies: [], policyKeys: [] };
    if (options?.debug ?? true) {
      logAuthzDebug(options?.context ?? "current", result);
    }
    return result;
  }

  try {
    const policies = await listPoliciesForEntity(supabase, entityId);
    const result: CurrentEntityPolicies = {
      entityId,
      policies,
      policyKeys: extractPolicyKeys(policies),
    };
    if (options?.debug ?? true) {
      logAuthzDebug(options?.context ?? "current", result);
    }
    return result;
  } catch (error) {
    console.warn("Failed to load policies for entity", error);
    const result: CurrentEntityPolicies = { entityId, policies: [], policyKeys: [] };
    if (options?.debug ?? true) {
      logAuthzDebug(options?.context ?? "current", result);
    }
    return result;
  }
}

export async function listPoliciesForCurrentUser(
  client?: SupabaseClient | null,
): Promise<PolicyRecord[]> {
  const { policies } = await getCurrentEntityAndPolicies(client ?? null, {
    context: "listPoliciesForCurrentUser",
    debug: false,
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
