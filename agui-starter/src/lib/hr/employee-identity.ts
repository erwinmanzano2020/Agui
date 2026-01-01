import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

function logIdentityRpcFailure(operation: string, error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code ?? null
      : null;
  const message = error instanceof Error ? error.message : String(error);
  const lowered = typeof message === "string" ? message.toLowerCase() : "";
  const missingSession =
    code === "AuthSessionMissingError" ||
    lowered.includes("auth session missing") ||
    lowered.includes("not authenticated");

  console.warn(`[identity] ${operation} failed`, { code, message, missingSession });
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

const ALLOWED_IDENTIFIER_TYPES = ["EMAIL", "PHONE"] as const;
export type IdentityIdentifierType = (typeof ALLOWED_IDENTIFIER_TYPES)[number];

type RawMaskedIdentifier = { type?: unknown; value_masked?: unknown; is_primary?: unknown };
export type MaskedIdentifier = { type: IdentityIdentifierType; value_masked: string; is_primary?: boolean };
export type IdentityLookupMatch = {
  entityId: string;
  displayName: string | null;
  matchedIdentifiers: MaskedIdentifier[];
  matchConfidence: "none" | "single" | "multiple";
};

function normalizeIdentifierType(input: unknown): IdentityIdentifierType | null {
  if (typeof input !== "string") {
    return null;
  }
  const upper = input.trim().toUpperCase();
  return (ALLOWED_IDENTIFIER_TYPES as readonly string[]).includes(upper)
    ? (upper as IdentityIdentifierType)
    : null;
}

function sanitizeMaskedIdentifier(raw: RawMaskedIdentifier): MaskedIdentifier | null {
  const type = normalizeIdentifierType(raw.type);
  if (!type) {
    return null;
  }
  const rawValue = typeof raw.value_masked === "string" ? raw.value_masked : "";
  const maskedValue = rawValue.trim().length > 0 ? rawValue : "••••";
  const isPrimary = typeof raw.is_primary === "boolean" ? raw.is_primary : undefined;
  return { type, value_masked: maskedValue, is_primary: isPrimary };
}

function mapSchemaCacheError(message: string): Error {
  const lowered = message.toLowerCase();
  if (lowered.includes("function") && lowered.includes("schema")) {
    return new Error(
      "Identity RPC unavailable (schema cache stale or migration missing). Run latest migrations and reload PostgREST schema.",
    );
  }
  return new Error(message);
}

export async function findOrCreateEntityForEmployee(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; fullName: string; email?: string | null; phone?: string | null },
): Promise<{ entityId: string | null }> {
  const email = normalizeEmployeeEmail(input.email);
  const phoneDetails = normalizeEmployeePhoneDetails(input.phone);

  const identifiers: Array<{ identifier_type: "EMAIL" | "PHONE"; identifier_value: string }> = [];
  if (email) {
    identifiers.push({ identifier_type: "EMAIL", identifier_value: email });
  }
  if (phoneDetails?.e164) {
    identifiers.push({ identifier_type: "PHONE", identifier_value: phoneDetails.e164 });
    if (phoneDetails.legacyLocal !== phoneDetails.e164) {
      identifiers.push({ identifier_type: "PHONE", identifier_value: phoneDetails.legacyLocal });
    }
  }

  if (identifiers.length === 0) {
    return { entityId: null };
  }

  const label = input.fullName?.trim() || email || phoneDetails?.e164 || phoneDetails?.legacyLocal || "Employee";
  const { data, error } = await supabase.rpc("hr_find_or_create_entity_for_employee", {
    p_house_id: input.houseId,
    p_display_name: label,
    p_identifiers: identifiers,
  });

  if (error) {
    logIdentityRpcFailure("hr_find_or_create_entity_for_employee", error);
    throw mapSchemaCacheError(error.message);
  }

  return { entityId: (data as string | null | undefined) ?? null };
}

export async function lookupEntitiesForEmployee(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; email?: string | null; phone?: string | null },
): Promise<IdentityLookupMatch[]> {
  const email = normalizeEmployeeEmail(input.email);
  const phoneDetails = normalizeEmployeePhoneDetails(input.phone);

  if (!email && !phoneDetails) return [];

  const identifiers = {
    email,
    phone: phoneDetails?.e164 ?? phoneDetails?.legacyLocal ?? null,
  };

  const { data, error } = await supabase.rpc("hr_lookup_entities_by_identifiers", {
    p_house_id: input.houseId,
    p_identifiers: identifiers,
  });

  if (error) {
    logIdentityRpcFailure("hr_lookup_entities_by_identifiers", error);
    throw mapSchemaCacheError(error.message);
  }

  const rows = (data as unknown as Array<Record<string, unknown>> | null) ?? [];

  return rows
    .map((row) => ({
      entityId: (row.entity_id as string | null) ?? "",
      displayName: (row.display_name as string | null) ?? null,
      matchedIdentifiers: ((row.matched_identifiers as RawMaskedIdentifier[] | null) ?? [])
        .map(sanitizeMaskedIdentifier)
        .filter((identifier): identifier is MaskedIdentifier => Boolean(identifier)),
      matchConfidence: ((row.match_confidence as IdentityLookupMatch["matchConfidence"] | null) ?? "multiple") as
        | "none"
        | "single"
        | "multiple",
    } satisfies IdentityLookupMatch))
    .filter((row) => row.entityId);
}

export type IdentitySummary = { entityId: string; displayName: string | null; identifiers: MaskedIdentifier[] };

export async function getIdentitySummariesForEmployees(
  supabase: SupabaseClient<Database>,
  input: { houseId: string; entityIds: string[] },
): Promise<IdentitySummary[]> {
  const uniqueIds = Array.from(new Set(input.entityIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase.rpc("hr_get_entity_identity_summary", {
    p_house_id: input.houseId,
    p_entity_ids: uniqueIds,
  });

  if (error) {
    logIdentityRpcFailure("hr_get_entity_identity_summary", error);
    throw mapSchemaCacheError(error.message);
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return rows
    .map((row) => ({
      entityId: (row.entity_id as string | null) ?? "",
      displayName: (row.display_name as string | null) ?? null,
      identifiers: ((row.identifiers as RawMaskedIdentifier[] | null) ?? [])
        .map(sanitizeMaskedIdentifier)
        .filter((identifier): identifier is MaskedIdentifier => Boolean(identifier)),
    } satisfies IdentitySummary))
    .filter((row) => row.entityId);
}
