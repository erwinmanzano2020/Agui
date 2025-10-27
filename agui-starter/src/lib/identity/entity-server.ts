import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getServiceSupabase } from "@/lib/supabase-service";
import { ensureEntityByEmail } from "@/lib/identity/entity";

function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (typeof phone !== "string") {
    return null;
  }
  const digits = phone.trim().replace(/[^\d+]/g, "");
  if (!digits) {
    return null;
  }
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export async function resolveEntityIdForUser(
  user: User,
  svc?: SupabaseClient,
): Promise<string | null> {
  const db = svc ?? getServiceSupabase();
  const email = normalizeEmail(user.email ?? null);
  if (email) {
    const { data, error } = await db
      .from("entity_identifiers")
      .select("entity_id")
      .eq("identifier_type", "EMAIL")
      .eq("identifier_value", email)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve entity by email: ${error.message}`);
    }

    if (data?.entity_id) {
      return data.entity_id as string;
    }
  }

  const phone = normalizePhone(user.phone ?? null);
  if (phone) {
    const { data, error } = await db
      .from("entity_identifiers")
      .select("entity_id")
      .eq("identifier_type", "PHONE")
      .eq("identifier_value", phone)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve entity by phone: ${error.message}`);
    }

    if (data?.entity_id) {
      return data.entity_id as string;
    }
  }

  const { data, error } = await db
    .from("entities")
    .select("id")
    .eq("profile->>auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve entity by auth user id: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function ensureEntityForUser(user: User, svc?: SupabaseClient): Promise<string> {
  const db = svc ?? getServiceSupabase();
  const existing = await resolveEntityIdForUser(user, db);
  if (existing) {
    return existing;
  }

  const email = normalizeEmail(user.email ?? null);
  if (!email) {
    throw new Error("Cannot create entity for user without email");
  }

  const entity = await ensureEntityByEmail(email, { displayName: user.email ?? email }, db);
  return entity.id;
}
