import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { getServiceSupabase } from "@/lib/supabase-service";

export type EmploymentStatus = "pending" | "active" | "suspended" | "ended";

export type EmploymentRecord = {
  id: string;
  business_id: string;
  entity_id: string;
  role_id: string | null;
  status: EmploymentStatus;
  created_at: string;
};

export async function ensureActiveEmployment(
  businessId: string,
  entityId: string,
  roleId?: string | null,
): Promise<EmploymentRecord> {
  const svc = getServiceSupabase();

  const { data: existing, error: existingError } = await svc
    .from("employments")
    .select("id, status, role_id, created_at")
    .eq("business_id", businessId)
    .eq("entity_id", entityId)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (existingError) {
    throw new Error((existingError as PostgrestError).message);
  }

  if (existing) {
    if (existing.status === "active" && (existing.role_id ?? null) === (roleId ?? null)) {
      return existing as EmploymentRecord;
    }

    const { data, error } = await svc
      .from("employments")
      .update({ status: "active", role_id: roleId ?? null })
      .eq("id", existing.id)
      .select("id, business_id, entity_id, role_id, status, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to activate employment");
    }

    return data as EmploymentRecord;
  }

  const { data, error } = await svc
    .from("employments")
    .insert({
      business_id: businessId,
      entity_id: entityId,
      role_id: roleId ?? null,
      status: "active",
    })
    .select("id, business_id, entity_id, role_id, status, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create employment");
  }

  return data as EmploymentRecord;
}

export async function listAccountUserIds(entityId: string): Promise<string[]> {
  const svc = getServiceSupabase();
  const { data, error } = await svc.from("accounts").select("user_id").eq("entity_id", entityId);
  if (error) {
    throw new Error((error as PostgrestError).message);
  }

  const result: string[] = [];
  for (const row of data ?? []) {
    const userId = (row as { user_id?: string | null }).user_id;
    if (typeof userId === "string" && userId) {
      result.push(userId);
    }
  }

  return result;
}
