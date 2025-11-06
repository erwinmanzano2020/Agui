import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { slugify } from "@/lib/slug";
import {
  evaluatePolicyForCurrentUser,
  getMyEntityId,
} from "@/lib/authz/server";

export type CreateRoleState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const createRoleInitialState: CreateRoleState = { status: "idle" };

function ensureString(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureUniqueHouseRoleSlug(
  service: SupabaseClient,
  houseId: string,
  baseSlug: string,
): Promise<string> {
  const fallback = baseSlug || "role";
  let attempt = 1;
  let candidate = fallback;

  while (attempt <= 50) {
    const { data, error } = await service
      .from("roles")
      .select("id")
      .eq("scope", "HOUSE")
      .eq("scope_ref", houseId)
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return candidate;
    }

    attempt += 1;
    candidate = `${fallback}-${attempt}`;
  }

  throw new Error("Unable to generate unique role slug");
}

async function assertHouseOwnership(
  service: SupabaseClient,
  entityId: string,
  houseId: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("house_roles")
    .select("role")
    .eq("entity_id", entityId)
    .eq("house_id", houseId)
    .eq("role", "house_owner")
    .maybeSingle();

  if (error) {
    console.error("Failed to verify house ownership", error);
    throw new Error("Failed to verify ownership");
  }

  return Boolean(data);
}

async function normalizePolicySelection(
  service: SupabaseClient,
  selections: string[],
): Promise<string[]> {
  if (selections.length === 0) {
    return [];
  }

  const unique = Array.from(new Set(selections.filter((value) => value)));
  if (unique.length === 0) {
    return [];
  }

  const { data, error } = await service
    .from("policies")
    .select("id, is_assignable")
    .in("id", unique);

  if (error) {
    console.error("Failed to validate policies", error);
    throw new Error("Failed to validate policies");
  }

  return (data ?? [])
    .filter((row) => row?.id && row.is_assignable)
    .map((row) => row.id as string);
}

export async function createCustomRole(
  _prevState: CreateRoleState,
  formData: FormData,
): Promise<CreateRoleState> {
  "use server";
  const houseId = ensureString(formData.get("houseId"));
  const houseSlug = ensureString(formData.get("houseSlug"));
  const name = ensureString(formData.get("name"));
  const policySelections = formData.getAll("policies").map((value) => ensureString(value));

  if (!houseId) {
    return { status: "error", message: "Missing house reference." };
  }

  if (!name) {
    return { status: "error", message: "Role name is required." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { status: "error", message: "Authentication required." };
  }

  const entityId = await getMyEntityId(supabase);
  if (!entityId) {
    return { status: "error", message: "Unable to resolve your account." };
  }

  const allowed = await evaluatePolicyForCurrentUser(
    { action: "roles:manage", resource: "house" },
    supabase,
  );
  if (!allowed) {
    return { status: "error", message: "You do not have permission to manage roles." };
  }

  const service = getServiceSupabase();

  try {
    const isOwner = await assertHouseOwnership(service, entityId, houseId);
    if (!isOwner) {
      return { status: "error", message: "Only house owners can create custom roles." };
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to verify ownership.",
    };
  }

  let roleId: string | null = null;

  try {
    const baseSlug = slugify(name, { fallback: "role" });
    const slug = await ensureUniqueHouseRoleSlug(service, houseId, baseSlug);

    const { data: insertedRole, error: insertError } = await service
      .from("roles")
      .insert({
        slug,
        label: name,
        scope: "HOUSE",
        scope_ref: houseId,
        description: null,
        owner_entity_id: entityId,
        is_system: false,
      })
      .select("id")
      .single();

    if (insertError || !insertedRole) {
      throw insertError ?? new Error("Failed to create role");
    }

    roleId = insertedRole.id as string;

    const validPolicies = await normalizePolicySelection(service, policySelections);
    if (validPolicies.length > 0) {
      const rows = validPolicies.map((policyId) => ({ role_id: roleId, policy_id: policyId }));
      const { error: policiesError } = await service.from("role_policies").insert(rows);
      if (policiesError) {
        throw policiesError;
      }
    }
  } catch (error) {
    if (roleId) {
      await service.from("roles").delete().eq("id", roleId);
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to create role.",
    };
  }

  if (houseSlug) {
    revalidatePath(`/company/${houseSlug}/roles/custom`);
  }

  return { status: "success" };
}
