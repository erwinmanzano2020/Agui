"use server";

import "server-only";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db.types";
import { ensureEntityForUser } from "@/lib/identity/entity-server";
import { emitEvent } from "@/lib/events/server";
import { getServiceSupabase } from "@/lib/supabase-service";

const HOUSES_CREATE_POLICY = "houses:create";
const PLATFORM_GM_ROLE = "game_master";

function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAllowlist(): Set<string> {
  const raw = process.env.AGUI_ADMIN_ALLOWLIST ?? "";
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function firstAdminEnabled(): boolean {
  return process.env.AGUI_ENABLE_FIRST_ADMIN === "true";
}

type ServiceSupabase = SupabaseClient<Database>;

async function ensurePolicyExists(
  supabase: ServiceSupabase,
  policyKey: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("policies")
    .select("id")
    .eq("key", policyKey)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.warn(`Failed to resolve policy ${policyKey}`, error);
    return null;
  }

  return data?.id ?? null;
}

async function ensurePolicyGrant(
  supabase: ServiceSupabase,
  entityId: string,
  policyKey: string,
): Promise<boolean> {
  const policyId = await ensurePolicyExists(supabase, policyKey);
  if (!policyId) {
    return false;
  }

  const { data: existing, error: existingError } = await supabase
    .from("entity_policy_grants")
    .select("entity_id")
    .eq("entity_id", entityId)
    .eq("policy_id", policyId)
    .maybeSingle<{ entity_id: string }>();

  if (existingError && existingError.code !== "PGRST116") {
    console.warn("Failed to check existing policy grant", existingError);
    return false;
  }

  if (existing) {
    return false;
  }

  const { error } = await supabase
    .from("entity_policy_grants")
    .insert({
      entity_id: entityId,
      policy_id: policyId,
      granted_via: "bootstrap",
    });

  if (error) {
    if (error.code === "23505") {
      return false;
    }
    console.warn("Failed to assign direct policy grant", error);
    return false;
  }

  return true;
}

async function ensurePlatformRole(
  supabase: ServiceSupabase,
  entityId: string,
  roleSlug: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("platform_roles")
    .select("roles")
    .eq("entity_id", entityId)
    .maybeSingle<{ roles: string[] }>();

  if (error && error.code !== "PGRST116") {
    console.warn("Failed to load platform roles for entity", error);
    return false;
  }

  const currentRoles = new Set((data?.roles ?? []).map((role) => role.trim()).filter(Boolean));
  if (currentRoles.has(roleSlug)) {
    return false;
  }

  currentRoles.add(roleSlug);
  const payload = {
    entity_id: entityId,
    roles: Array.from(currentRoles),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("platform_roles")
    .upsert(payload, { onConflict: "entity_id" });

  if (upsertError) {
    console.warn("Failed to upsert platform role assignment", upsertError);
    return false;
  }

  return true;
}

async function hasPolicyAssignments(
  supabase: ServiceSupabase,
  policyKey: string,
): Promise<boolean> {
  const { error, count } = await supabase
    .from("entity_policies")
    .select("entity_id", { count: "exact", head: true })
    .eq("policy_key", policyKey);

  if (error) {
    console.warn("Failed to count existing policy assignments", error);
    return true; // avoid bootstrapping on errors
  }

  return (count ?? 0) > 0;
}

export async function bootstrapPoliciesForSession(session: Session | null | undefined) {
  if (!session?.user) {
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured; skipping policy bootstrap");
    return;
  }

  const email = normalizeEmail(session.user.email ?? null);
  const allowlist = parseAllowlist();
  const allowlisted = email ? allowlist.has(email) : false;
  const firstAdmin = firstAdminEnabled();

  if (!allowlisted && !firstAdmin) {
    return;
  }

  const supabase = getServiceSupabase<Database>();

  let shouldGrant = allowlisted;
  if (!shouldGrant && firstAdmin) {
    const alreadyAssigned = await hasPolicyAssignments(supabase, HOUSES_CREATE_POLICY);
    shouldGrant = !alreadyAssigned;
  }

  if (!shouldGrant) {
    return;
  }

  let entityId: string;
  try {
    entityId = await ensureEntityForUser(session.user, supabase);
  } catch (error) {
    console.warn("Failed to ensure entity for policy bootstrap", error);
    return;
  }

  let changed = false;
  const roleChanged = await ensurePlatformRole(supabase, entityId, PLATFORM_GM_ROLE);
  changed = changed || roleChanged;

  const policyChanged = await ensurePolicyGrant(supabase, entityId, HOUSES_CREATE_POLICY);
  changed = changed || policyChanged;

  if (changed) {
    await emitEvent(`tiles:user:${session.user.id}`, "invalidate", { reason: "policy bootstrap" });
  }
}
