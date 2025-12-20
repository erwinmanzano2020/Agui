import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

type IdentifierType = "EMAIL" | "PHONE";

type IdentifierColumnVariant =
  | { type: "identifier_type"; value: "identifier_value"; normalize: (value: IdentifierType) => string }
  | { type: "kind"; value: "value_norm"; normalize: (value: IdentifierType) => string };

const COLUMN_VARIANTS: IdentifierColumnVariant[] = [
  {
    type: "identifier_type",
    value: "identifier_value",
    normalize: (value) => value,
  },
  {
    type: "kind",
    value: "value_norm",
    normalize: (value) => value.toLowerCase(),
  },
];

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = typeof (error as { message?: unknown }).message === "string" ? (error as { message: string }).message : "";
  if (!message) return false;
  return message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist");
}

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

async function findExistingEntityId(
  supabase: SupabaseClient<Database>,
  identifier: { type: IdentifierType; value: string },
): Promise<string | null> {
  for (const variant of COLUMN_VARIANTS) {
    try {
      const { data, error } = await supabase
        .from("entity_identifiers")
        .select("entity_id")
        .eq(variant.type as keyof Database["public"]["Tables"]["entity_identifiers"]["Row"], variant.normalize(identifier.type) as never)
        .eq(variant.value as keyof Database["public"]["Tables"]["entity_identifiers"]["Row"], identifier.value as never)
        .maybeSingle();

      if (error) {
        if (isMissingColumnError(error)) {
          continue;
        }
        throw new Error(error.message);
      }

      if (data?.entity_id) {
        return data.entity_id as string;
      }
    } catch (error) {
      if (isMissingColumnError(error)) {
        continue;
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  return null;
}

async function findLegacyEntityByPhone(
  supabase: SupabaseClient<Database>,
  legacyPhone: string,
): Promise<string | null> {
  for (const variant of COLUMN_VARIANTS) {
    if (variant.type !== "kind" || variant.value !== "value_norm") {
      continue;
    }
    try {
      const { data, error } = await supabase
        .from("entity_identifiers")
        .select("entity_id")
        .eq(variant.type as keyof Database["public"]["Tables"]["entity_identifiers"]["Row"], variant.normalize("PHONE") as never)
        .eq(variant.value as keyof Database["public"]["Tables"]["entity_identifiers"]["Row"], legacyPhone as never)
        .maybeSingle();

      if (error) {
        if (isMissingColumnError(error)) {
          continue;
        }
        throw new Error(error.message);
      }

      if (data?.entity_id) {
        return data.entity_id as string;
      }
    } catch (error) {
      if (isMissingColumnError(error)) {
        continue;
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  return null;
}

async function insertIdentifiersWithFallback(
  supabase: SupabaseClient<Database>,
  entityId: string,
  identifiers: Array<{ type: IdentifierType; value: string }>,
  primary: IdentifierType,
): Promise<void> {
  if (identifiers.length === 0) return;

  const primaryVariant = COLUMN_VARIANTS[0];
  const primaryPayload = identifiers.map((item) => ({
    entity_id: entityId,
    [primaryVariant.type]: primaryVariant.normalize(item.type),
    [primaryVariant.value]: item.value,
    is_primary: item.type === primary,
  }));

  const { error } = await supabase.from("entity_identifiers").insert(primaryPayload as never);
  if (!error) {
    return;
  }

  if (!isMissingColumnError(error)) {
    throw new Error(error.message);
  }

  const fallbackVariant = COLUMN_VARIANTS[1];
  const fallbackPayload = identifiers.map((item) => ({
    entity_id: entityId,
    [fallbackVariant.type]: fallbackVariant.normalize(item.type),
    [fallbackVariant.value]: item.value,
  }));

  const { error: fallbackError } = await supabase.from("entity_identifiers").insert(fallbackPayload as never);
  if (fallbackError) {
    throw new Error(fallbackError.message);
  }
}

export async function findOrCreateEntityForEmployee(
  supabase: SupabaseClient<Database>,
  input: { fullName: string; email?: string | null; phone?: string | null },
): Promise<{ entityId: string | null }> {
  const email = normalizeEmployeeEmail(input.email);
  const phoneDetails = normalizeEmployeePhoneDetails(input.phone);

  const identifiers: Array<{ type: IdentifierType; value: string }> = [];
  if (email) {
    identifiers.push({ type: "EMAIL", value: email });
  }
  if (phoneDetails?.e164) {
    identifiers.push({ type: "PHONE", value: phoneDetails.e164 });
  }

  if (identifiers.length === 0) {
    return { entityId: null };
  }

  for (const candidate of identifiers) {
    const existing = await findExistingEntityId(supabase, candidate);
    if (existing) {
      return { entityId: existing };
    }
  }

  if (phoneDetails?.legacyLocal) {
    const legacy = await findLegacyEntityByPhone(supabase, phoneDetails.legacyLocal);
    if (legacy) {
      return { entityId: legacy };
    }
  }

  const label = input.fullName?.trim() || email || input.phone || "Employee";
  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .insert({ display_name: label })
    .select("id")
    .single();

  if (entityError || !entity) {
    throw new Error(entityError?.message ?? "Failed to create entity");
  }

  const primary = email ? "EMAIL" : "PHONE";
  await insertIdentifiersWithFallback(supabase, entity.id, identifiers, primary);

  return { entityId: entity.id as string };
}
