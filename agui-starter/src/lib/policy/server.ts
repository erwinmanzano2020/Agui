import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase-server";
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

export async function listPoliciesForCurrentUser(
  client?: SupabaseClient | null,
): Promise<PolicyRecord[]> {
  const supabase = client ?? (await createServerSupabaseClient());
  const entityId = await getMyEntityId(supabase);
  if (!entityId) {
    return [];
  }

  try {
    return await listPoliciesForEntity(supabase, entityId);
  } catch (error) {
    console.warn("Failed to load policies for entity", error);
    return [];
  }
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
