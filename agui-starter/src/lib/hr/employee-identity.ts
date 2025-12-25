import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

export function normalizeEmployeeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export type NormalizedPhone = { e164: string; legacyLocal: string };

export function normalizeEmployeePhoneDetails(phone: string | null | undefined): NormalizedPhone | null {
  if (typeof phone !== "string") return null;
  const cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  // PH-focused normalization: accept +63 / 63 / 09 / 9xxxxxxxxx
  const startsWithPlus63 = cleaned.startsWith("+63");
  const startsWith63 = cleaned.startsWith("63");
  const startsWith09 = cleaned.startsWith("09");
  const startsWith9 = cleaned.startsWith("9");

  if (startsWithPlus63 || startsWith63) {
    const digits = cleaned.replace(/^\+?63/, "");
    if (!digits) return null;
    const legacyLocal = `0${digits}`;
    const e164 = `+63${digits}`;
    return { e164, legacyLocal };
  }

  if (startsWith09) {
    const digits = cleaned.slice(1); // drop leading 0
    if (!digits) return null;
    const e164 = `+63${digits}`;
    const legacyLocal = `0${digits}`;
    return { e164, legacyLocal };
  }

  if (startsWith9 && cleaned.length >= 10) {
    // treat as missing leading 0
    const digits = cleaned;
    const e164 = `+63${digits}`;
    const legacyLocal = `0${digits}`;
    return { e164, legacyLocal };
  }

  return null;
}

export function normalizeEmployeePhone(phone: string | null | undefined): string | null {
  return normalizeEmployeePhoneDetails(phone)?.e164 ?? null;
}

export async function findOrCreateEntityForEmployee(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; fullName: string; email?: string | null; phone?: string | null },
): Promise<{ entityId: string | null }> {
  const email = normalizeEmployeeEmail(input.email);
  const phoneDetails = normalizeEmployeePhoneDetails(input.phone);

  if (!email && !phoneDetails) {
    return { entityId: null };
  }

  const label = input.fullName?.trim() || email || input.phone || "Employee";
  const { data, error } = await supabase.rpc("hr_find_or_create_entity_for_employee", {
    p_house_id: input.houseId,
    p_display_name: label,
    p_email: email,
    p_phone: phoneDetails?.e164 ?? input.phone ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { entityId: (data as string | null | undefined) ?? null };
}
