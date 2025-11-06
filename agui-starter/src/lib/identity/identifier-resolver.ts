// src/lib/identity/identifier-resolver.ts
import { createHash } from "node:crypto";

import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";

import type {
  Database,
  EntityIdentifierInsert,
  EntityIdentifierRow,
  EntityRow,
  EntitlementRow,
  Json,
} from "@/lib/db.types";

type IdentifierKind = EntityIdentifierRow["kind"];

export type IdentifierInput = {
  kind: IdentifierKind;
  value: string;
  meta?: Record<string, unknown> | null;
};

export type VerificationHints = {
  verified?: boolean;
  verifiedAt?: string | null;
};

export type ResolverOptions = {
  displayName?: string | null;
  profile?: Record<string, unknown> | null;
  verification?: VerificationHints | null;
};

export type IdentifierResolverResult = {
  entity: EntityRow;
  identifier: EntityIdentifierRow;
  entitlements: EntitlementRow[];
  created: boolean;
};

export interface IdentifierResolverStore {
  findByFingerprint(kind: IdentifierKind, fingerprint: string): Promise<EntityIdentifierRow | null>;
  createEntity(args: {
    kind: IdentifierKind;
    normalizedValue: string;
    displayName?: string | null;
    profile?: Record<string, unknown> | null;
  }): Promise<EntityRow>;
  linkIdentifier(args: {
    entityId: string;
    kind: IdentifierKind;
    normalizedValue: string;
    fingerprint: string;
    meta?: Record<string, unknown> | null;
    verification?: VerificationHints | null;
  }): Promise<EntityIdentifierRow>;
  loadEntity(entityId: string): Promise<EntityRow>;
  listEntitlements(entityId: string): Promise<EntitlementRow[]>;
  ensureEntitlement(
    entityId: string,
    code: string,
    source: string,
    context: Record<string, unknown>,
  ): Promise<void>;
}

const SENIOR_KEYS = ["senior", "isSenior", "is_senior", "senior_verified", "verified_senior"];

const toJson = (value: Record<string, unknown> | null | undefined): Json | null => {
  if (!value) return null;
  return value as unknown as Json;
};

const DEFAULT_SENIOR_SOURCE = "gov_id_auto";

export function normalizeIdentifier(kind: IdentifierKind, raw: string): string {
  const input = raw ?? "";
  const trimmed = input.trim();

  switch (kind) {
    case "email":
      return trimmed.toLowerCase();
    case "phone":
      return trimmed.replace(/[^0-9]/g, "");
    case "gov_id":
      return trimmed.toLowerCase().replace(/[\s-]/g, "");
    case "loyalty_card":
    case "employee_no":
      return trimmed.toLowerCase().replace(/[\s-]/g, "");
    case "qr":
      return trimmed.toLowerCase();
    default:
      return trimmed.toLowerCase();
  }
}

export function fingerprintIdentifier(kind: IdentifierKind, normalized: string): string {
  if (kind === "gov_id") {
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  }
  return normalized;
}

function buildDefaultDisplayName(kind: IdentifierKind, normalized: string): string {
  if (kind === "email") return normalized;
  if (kind === "phone") return normalized || "phone";
  if (kind === "gov_id") {
    const suffix = normalized.slice(-4);
    return suffix ? `Gov ID ••••${suffix}` : "Gov ID";
  }
  if (kind === "qr") {
    return normalized ? `QR ${normalized.slice(0, 8)}` : "QR";
  }
  return normalized || kind;
}

function isVerified(meta: Record<string, unknown> | null | undefined, verification?: VerificationHints | null): boolean {
  if (verification?.verified) return true;
  if (verification?.verifiedAt) return true;

  if (!meta) return false;

  const flags = ["verified", "is_verified", "verified_senior", "senior_verified"];
  return flags.some((key) => Boolean((meta as Record<string, unknown>)[key]));
}

function hasSeniorHint(normalized: string, meta: Record<string, unknown> | null | undefined): boolean {
  if (meta) {
    if (SENIOR_KEYS.some((key) => Boolean((meta as Record<string, unknown>)[key]))) {
      return true;
    }
  }

  return /senior/i.test(normalized);
}

function shouldGrantSenior(
  kind: IdentifierKind,
  normalized: string,
  meta: Record<string, unknown> | null | undefined,
  verification?: VerificationHints | null,
): boolean {
  if (kind !== "gov_id") return false;
  if (!isVerified(meta, verification)) return false;
  return hasSeniorHint(normalized, meta);
}

export async function resolveIdentifier(
  store: IdentifierResolverStore,
  input: IdentifierInput,
  options: ResolverOptions = {},
): Promise<IdentifierResolverResult> {
  const normalized = normalizeIdentifier(input.kind, input.value);

  if (!normalized) {
    throw new Error("Identifier value is required");
  }

  const fingerprint = fingerprintIdentifier(input.kind, normalized);
  const existing = await store.findByFingerprint(input.kind, fingerprint);

  let entity: EntityRow;
  let identifier: EntityIdentifierRow;
  let created = false;

  if (existing) {
    entity = await store.loadEntity(existing.entity_id);
    identifier = existing;
  } else {
    created = true;
    entity = await store.createEntity({
      kind: input.kind,
      normalizedValue: normalized,
      displayName: options.displayName ?? null,
      profile: options.profile ?? null,
    });

    identifier = await store.linkIdentifier({
      entityId: entity.id,
      kind: input.kind,
      normalizedValue: normalized,
      fingerprint,
      meta: input.meta ?? null,
      verification: options.verification ?? null,
    });
  }

  const entitlements = await store.listEntitlements(entity.id);

  if (shouldGrantSenior(input.kind, normalized, input.meta ?? null, options.verification)) {
    const hasSenior = entitlements.some((ent) => ent.code === "senior");
    if (!hasSenior) {
      await store.ensureEntitlement(entity.id, "senior", DEFAULT_SENIOR_SOURCE, {
        identifier_id: identifier.id,
      });
      const refreshed = await store.listEntitlements(entity.id);
      return { entity, identifier, entitlements: refreshed, created };
    }
  }

  return { entity, identifier, entitlements, created };
}

function normalizeProfile(profile: Record<string, unknown> | null | undefined): Json {
  if (!profile) return {} as Json;
  return profile as unknown as Json;
}

function normalizeMeta(meta: Record<string, unknown> | null | undefined): Json {
  if (!meta) return {} as Json;
  return meta as unknown as Json;
}

function mapEntity(row: EntityRow | null, error: PostgrestError | null, hint: string): EntityRow {
  if (error) {
    throw new Error(`${hint}: ${error.message}`);
  }
  if (!row) {
    throw new Error(`${hint}: not found`);
  }
  return row;
}

class SupabaseIdentifierResolverStore implements IdentifierResolverStore {
  private client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async findByFingerprint(kind: IdentifierKind, fingerprint: string): Promise<EntityIdentifierRow | null> {
    const { data, error } = await this.client
      .from("entity_identifiers")
      .select("id, entity_id, kind, issuer, value_norm, fingerprint, meta, verified_at, added_by_entity_id, created_at, updated_at")
      .eq("kind", kind)
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find identifier: ${error.message}`);
    }

    return data ?? null;
  }

  async createEntity(args: {
    kind: IdentifierKind;
    normalizedValue: string;
    displayName?: string | null;
    profile?: Record<string, unknown> | null;
  }): Promise<EntityRow> {
    const display = (args.displayName ?? "").trim() || buildDefaultDisplayName(args.kind, args.normalizedValue);
    const profile = normalizeProfile(args.profile);

    const { data, error } = await this.client
      .from("entities")
      .insert({
        display_name: display,
        profile,
      })
      .select("id, display_name, profile, is_gm, created_at, updated_at")
      .single();

    return mapEntity(data, error, "Failed to create entity");
  }

  async linkIdentifier(args: {
    entityId: string;
    kind: IdentifierKind;
    normalizedValue: string;
    fingerprint: string;
    meta?: Record<string, unknown> | null;
    verification?: VerificationHints | null;
  }): Promise<EntityIdentifierRow> {
    const shouldVerify = Boolean(args.verification?.verified) || Boolean(args.verification?.verifiedAt);
    const record: EntityIdentifierInsert = {
      entity_id: args.entityId,
      kind: args.kind,
      value_norm: args.normalizedValue,
      meta: normalizeMeta(args.meta ?? null),
    };

    if (shouldVerify) {
      record.verified_at = args.verification?.verifiedAt ?? new Date().toISOString();
    }

    const { data, error } = await this.client
      .from("entity_identifiers")
      .insert(record)
      .select("id, entity_id, kind, issuer, value_norm, fingerprint, meta, verified_at, added_by_entity_id, created_at, updated_at")
      .single();

    if (!error && data) {
      return data;
    }

    if (error?.code === "23505") {
      const existing = await this.findByFingerprint(args.kind, args.fingerprint);
      if (existing) {
        return existing;
      }
    }

    if (error) {
      throw new Error(`Failed to link identifier: ${error.message}`);
    }

    throw new Error("Failed to link identifier: unknown error");
  }

  async loadEntity(entityId: string): Promise<EntityRow> {
    const { data, error } = await this.client
      .from("entities")
      .select("id, display_name, profile, is_gm, created_at, updated_at")
      .eq("id", entityId)
      .maybeSingle();

    return mapEntity(data, error, "Failed to load entity");
  }

  async listEntitlements(entityId: string): Promise<EntitlementRow[]> {
    const { data, error } = await this.client
      .from("entitlements")
      .select("entity_id, code, source, granted_at, meta")
      .eq("entity_id", entityId);

    if (error) {
      throw new Error(`Failed to load entitlements: ${error.message}`);
    }

    return data ?? [];
  }

  async ensureEntitlement(
    entityId: string,
    code: string,
    source: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.client
      .from("entitlements")
      .upsert(
        {
          entity_id: entityId,
          code,
          source,
          granted_at: new Date().toISOString(),
          meta: toJson(context) ?? {},
        },
        { onConflict: "entity_id,code" },
      );

    if (error) {
      throw new Error(`Failed to grant entitlement: ${error.message}`);
    }
  }
}

export function createSupabaseIdentifierResolverStore(
  client: SupabaseClient<Database>,
): IdentifierResolverStore {
  return new SupabaseIdentifierResolverStore(client);
}

export const internal = {
  buildDefaultDisplayName,
  hasSeniorHint,
  isVerified,
  shouldGrantSenior,
};
