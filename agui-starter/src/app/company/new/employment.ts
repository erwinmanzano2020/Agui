"use server";

import type { PostgrestError } from "@supabase/supabase-js";

const ROLE_PREFERENCE_ORDER = ["house_owner", "owner", "house_manager", "manager"] as const;

type RoleRow = {
  id?: unknown;
  slug?: unknown;
  scope?: unknown;
};

type RpcResponse = {
  employment?: { id?: unknown } | null;
};

type SupabaseSelectResult = { data: unknown; error: unknown };

type SupabaseTableLike = {
  select: (columns: string) => Promise<SupabaseSelectResult>;
  upsert?: (
    values: Record<string, unknown>,
    options: { onConflict: string },
  ) => Promise<SupabaseSelectResult>;
};

type SupabaseClientLike = {
  from: (table: string) => SupabaseTableLike;
  rpc: (name: string, params: Record<string, unknown>) => Promise<SupabaseSelectResult>;
};

export type CreatorEmploymentResult = {
  employmentId: string | null;
  roleId: string;
  roleSlug: string;
};

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return new Error(message);
    }
  }

  return new Error(fallbackMessage);
}

function extractEmploymentId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const container = payload as RpcResponse;
  const employment = container.employment;
  if (!employment || typeof employment !== "object") {
    return null;
  }

  const candidate = employment as { id?: unknown };
  return typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : null;
}

function isMissingFunction(error: unknown, functionName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  if (!message) {
    return false;
  }

  return message.includes("function") && message.includes(functionName) && message.includes("does not exist");
}

function normalizeSlug(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeScope(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function resolveCreatorEmploymentRole(
  supabase: unknown,
): Promise<{ roleId: string; roleSlug: string }> {
  const client = supabase as SupabaseClientLike;
  const { data, error } = await client.from("roles").select("id, slug, scope");

  if (error) {
    throw toError(error, "Failed to resolve roles for employment onboarding");
  }

  const rows = Array.isArray(data) ? (data as RoleRow[]) : [];

  for (const preferredSlug of ROLE_PREFERENCE_ORDER) {
    const match = rows.find((row) => normalizeScope(row.scope) === "HOUSE" && normalizeSlug(row.slug) === preferredSlug);
    const roleId = match && typeof match.id === "string" && match.id.length > 0 ? match.id : null;
    if (roleId) {
      return { roleId, roleSlug: preferredSlug };
    }
  }

  throw new Error("No eligible owner or manager role found for employment");
}

export async function ensureCreatorEmployment(
  supabase: unknown,
  businessId: string,
  entityId: string,
): Promise<CreatorEmploymentResult> {
  const client = supabase as SupabaseClientLike;
  const { roleId, roleSlug } = await resolveCreatorEmploymentRole(client);

  const { data: rpcData, error: rpcError } = await client.rpc("onboard_employee", {
    p_house_id: businessId,
    p_entity_id: entityId,
    p_role_id: roleId,
    p_role_slug: roleSlug,
  });

  if (!rpcError) {
    return { employmentId: extractEmploymentId(rpcData), roleId, roleSlug };
  }

  if (!isMissingFunction(rpcError, "onboard_employee")) {
    throw toError(rpcError, "Failed to onboard creator employment");
  }

  const employmentTable = client.from("employments");
  const upsert = employmentTable.upsert;
  if (typeof upsert !== "function") {
    throw new Error("Supabase client missing upsert implementation for employments table");
  }

  const { error: upsertError } = await upsert(
    {
      business_id: businessId,
      entity_id: entityId,
      role_id: roleId,
      status: "active",
    },
    { onConflict: "business_id,entity_id" },
  );

  if (upsertError) {
    throw toError(upsertError as PostgrestError, "Failed to ensure creator employment record");
  }

  return { employmentId: null, roleId, roleSlug };
}
