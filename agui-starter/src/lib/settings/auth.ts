import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyEntityId, getMyRoles, hasRoleInAssignments } from "@/lib/authz/server";

import type { SettingScope } from "./catalog";

const PRIVILEGED_ROLES = new Set([
  "owner",
  "admin",
  "gm",
  "manager",
  "house_owner",
  "house_manager",
  "branch_admin",
  "branch_manager",
]);

export class SettingsAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SettingsAuthError";
    this.status = status;
  }
}

type SettingsScopeRequest = {
  scope: SettingScope;
  businessId?: string | null;
  branchId?: string | null;
};

type ActorContext = {
  supabase: SupabaseClient<Database>;
  entityId: string;
  isGM: boolean;
};

async function resolveBranchBusinessId(
  supabase: SupabaseClient<Database>,
  branchId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("branches")
    .select("house_id")
    .eq("id", branchId)
    .maybeSingle<{ house_id: string | null }>();

  if (error) {
    console.warn("Failed to resolve branch business for settings access", error);
    return null;
  }

  return data?.house_id ?? null;
}

async function hasHousePrivilege(
  supabase: SupabaseClient<Database>,
  entityId: string,
  businessId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("house_roles")
    .select("role")
    .eq("entity_id", entityId)
    .eq("house_id", businessId);

  if (error) {
    console.warn("Failed to evaluate house privileges for settings", error);
    return false;
  }

  return (data ?? []).some((row) => {
    const roleValue = (row as { role?: string | null }).role;
    return typeof roleValue === "string" && PRIVILEGED_ROLES.has(roleValue.toLowerCase());
  });
}

async function getActor(): Promise<ActorContext> {
  const supabase = await createServerSupabaseClient();
  const entityId = await getMyEntityId(supabase);
  if (!entityId) {
    throw new SettingsAuthError(401, "Not authenticated");
  }

  const roles = await getMyRoles(supabase);
  const isGM = hasRoleInAssignments(roles, "PLATFORM", "game_master");
  return { supabase, entityId, isGM } satisfies ActorContext;
}

async function ensureBusinessAccess(
  actor: ActorContext,
  businessId: string,
): Promise<void> {
  if (actor.isGM) {
    return;
  }
  const allowed = await hasHousePrivilege(actor.supabase, actor.entityId, businessId);
  if (!allowed) {
    throw new SettingsAuthError(403, "Forbidden");
  }
}

async function ensureBranchAccess(
  actor: ActorContext,
  branchId: string,
  businessId?: string | null,
): Promise<string> {
  if (actor.isGM) {
    return businessId ?? (await resolveBranchBusinessId(actor.supabase, branchId)) ?? branchId;
  }

  const derived = businessId ?? (await resolveBranchBusinessId(actor.supabase, branchId));
  if (!derived) {
    throw new SettingsAuthError(400, "Unknown branch context");
  }
  await ensureBusinessAccess(actor, derived);
  return derived;
}

export async function ensureSettingsReadAccess(request: SettingsScopeRequest): Promise<ActorContext> {
  const actor = await getActor();
  if (actor.isGM) {
    return actor;
  }

  switch (request.scope) {
    case "GM": {
      const contextBusiness = request.businessId;
      if (contextBusiness) {
        await ensureBusinessAccess(actor, contextBusiness);
        return actor;
      }
      throw new SettingsAuthError(403, "GM defaults require elevated access");
    }
    case "BUSINESS": {
      if (!request.businessId) {
        throw new SettingsAuthError(400, "businessId is required");
      }
      await ensureBusinessAccess(actor, request.businessId);
      return actor;
    }
    case "BRANCH": {
      if (!request.branchId) {
        throw new SettingsAuthError(400, "branchId is required");
      }
      await ensureBranchAccess(actor, request.branchId, request.businessId);
      return actor;
    }
    default:
      throw new SettingsAuthError(403, "Forbidden");
  }
}

export async function ensureSettingsWriteAccess(request: SettingsScopeRequest): Promise<ActorContext> {
  const actor = await getActor();
  if (actor.isGM) {
    return actor;
  }

  switch (request.scope) {
    case "GM": {
      throw new SettingsAuthError(403, "Only GM can edit platform defaults");
    }
    case "BUSINESS": {
      if (!request.businessId) {
        throw new SettingsAuthError(400, "businessId is required");
      }
      await ensureBusinessAccess(actor, request.businessId);
      return actor;
    }
    case "BRANCH": {
      if (!request.branchId) {
        throw new SettingsAuthError(400, "branchId is required");
      }
      await ensureBranchAccess(actor, request.branchId, request.businessId);
      return actor;
    }
    default:
      throw new SettingsAuthError(403, "Forbidden");
  }
}
