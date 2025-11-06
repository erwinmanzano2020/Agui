import { createHash } from "node:crypto";

import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";

import type {
  EntitlementInsert,
  EntitlementRow,
  IdentityDatabase,
  IdentityEntityInsert,
  IdentityEntityRow,
  IdentifierInsert,
  IdentifierRow,
  Json,
} from "@/lib/db.types";

export type IdentifierKind = IdentifierRow["kind"];

export type IdentifierInput = {
  kind: IdentifierKind;
  value: string;
};

export type VerificationHints = {
  verified?: boolean;
  verifiedAt?: string | null;
};

export type ResolverOptions = {
  entityKind?: IdentityEntityRow["kind"];
  profile?: Record<string, unknown> | null;
  verification?: VerificationHints | null;
};

export type IdentifierResolverResult = {
  entity: IdentityEntityRow;
  identifier: IdentifierRow;
  entitlements: EntitlementRow[];
  created: boolean;
};

export interface IdentifierResolverStore {
  findIdentifier(kind: IdentifierKind, value: string): Promise<IdentifierRow | null>;
  createEntity(input: IdentityEntityInsert): Promise<IdentityEntityRow>;
  updateEntity(entityId: string, patch: Partial<IdentityEntityInsert>): Promise<void>;
  deleteEntity(entityId: string): Promise<void>;
  linkIdentifier(input: IdentifierInsert): Promise<IdentifierRow>;
  loadEntity(entityId: string): Promise<IdentityEntityRow>;
  listEntitlements(entityId: string): Promise<EntitlementRow[]>;
  upsertEntitlement(input: EntitlementInsert): Promise<void>;
}

const SENIOR_PATTERN = /senior/i;
const GOV_ID_HASH_PREFIX = "gov:";

function normalizeProfile(profile: Record<string, unknown> | null | undefined): Json {
  if (!profile) return {} as Json;
  return profile as unknown as Json;
}

export function normalizeIdentifier(kind: IdentifierKind, raw: string): string {
  const input = raw ?? "";
  const trimmed = input.trim();

  switch (kind) {
    case "email":
      return trimmed.toLowerCase();
    case "phone":
      return trimmed.replace(/[^0-9]/g, "");
    case "gov_id":
      return trimmed.replace(/[\s-]/g, "").toUpperCase();
    case "qr":
    default:
      return trimmed.toLowerCase();
  }
}

function hashGovId(value: string): string {
  return `${GOV_ID_HASH_PREFIX}${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function storeValue(kind: IdentifierKind, normalized: string): string {
  if (kind === "gov_id") {
    return hashGovId(normalized);
  }
  return normalized;
}

function seniorEligible(kind: IdentifierKind, normalized: string, verification?: VerificationHints | null): boolean {
  if (kind !== "gov_id") return false;
  if (!verification?.verified && !verification?.verifiedAt) return false;
  return SENIOR_PATTERN.test(normalized);
}

function mapEntity(row: IdentityEntityRow | null, error: PostgrestError | null, hint: string): IdentityEntityRow {
  if (error) {
    throw new Error(`${hint}: ${error.message}`);
  }
  if (!row) {
    throw new Error(`${hint}: not found`);
  }
  return row;
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

  const storedValue = storeValue(input.kind, normalized);
  const existing = await store.findIdentifier(input.kind, storedValue);

  let entity: IdentityEntityRow;
  let identifier: IdentifierRow;
  let created = false;

  if (existing) {
    entity = await store.loadEntity(existing.entity_id);
    identifier = existing;
  } else {
    created = true;
    entity = await store.createEntity({
      kind: options.entityKind ?? "person",
      primary_identifier: normalized,
      profile: normalizeProfile(options.profile ?? null),
    });

    identifier = await store.linkIdentifier({
      entity_id: entity.id,
      kind: input.kind,
      value: storedValue,
      verified_at: options.verification?.verifiedAt ?? (options.verification?.verified ? new Date().toISOString() : null),
    });

    if (identifier.entity_id !== entity.id) {
      await store.deleteEntity(entity.id);
      entity = await store.loadEntity(identifier.entity_id);
      created = false;
    }

    if (!entity.primary_identifier) {
      await store.updateEntity(entity.id, { primary_identifier: normalized });
      entity = await store.loadEntity(entity.id);
    }
  }

  const entitlements = await store.listEntitlements(entity.id);

  if (seniorEligible(input.kind, normalized, options.verification)) {
    const hasSenior = entitlements.some((ent) => ent.code === "senior");
    if (!hasSenior) {
      await store.upsertEntitlement({
        entity_id: entity.id,
        code: "senior",
        source: "gov_id_auto",
      });
      const refreshed = await store.listEntitlements(entity.id);
      return { entity, identifier, entitlements: refreshed, created };
    }
  }

  return { entity, identifier, entitlements, created };
}

class SupabaseIdentifierResolverStore implements IdentifierResolverStore {
  constructor(private client: SupabaseClient<IdentityDatabase>) {}

  async findIdentifier(kind: IdentifierKind, value: string): Promise<IdentifierRow | null> {
    const { data, error } = await this.client
      .from("identifiers")
      .select("id, entity_id, kind, value, verified_at")
      .eq("kind", kind)
      .eq("value", value)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to look up identifier: ${error.message}`);
    }

    return data ?? null;
  }

  async createEntity(input: IdentityEntityInsert): Promise<IdentityEntityRow> {
    const record: IdentityEntityInsert = {
      kind: input.kind,
      primary_identifier: input.primary_identifier ?? null,
      profile: input.profile ?? ({} as Json),
    };

    const { data, error } = await this.client
      .from("entities")
      .insert(record)
      .select("id, kind, primary_identifier, profile, created_at")
      .single();

    return mapEntity(data, error, "Failed to create entity");
  }

  async updateEntity(entityId: string, patch: Partial<IdentityEntityInsert>): Promise<void> {
    const { error } = await this.client
      .from("entities")
      .update(patch)
      .eq("id", entityId);

    if (error) {
      throw new Error(`Failed to update entity: ${error.message}`);
    }
  }

  async deleteEntity(entityId: string): Promise<void> {
    const { error } = await this.client.from("entities").delete().eq("id", entityId);
    if (error) {
      throw new Error(`Failed to delete entity: ${error.message}`);
    }
  }

  async linkIdentifier(input: IdentifierInsert): Promise<IdentifierRow> {
    const record: IdentifierInsert = {
      entity_id: input.entity_id,
      kind: input.kind,
      value: input.value,
      verified_at: input.verified_at ?? null,
    };

    const { data, error } = await this.client
      .from("identifiers")
      .insert(record)
      .select("id, entity_id, kind, value, verified_at")
      .single();

    if (!error && data) {
      return data;
    }

    if (error?.code === "23505") {
      const existing = await this.findIdentifier(record.kind, record.value);
      if (existing) {
        return existing;
      }
    }

    throw new Error(`Failed to link identifier: ${error ? error.message : "unknown error"}`);
  }

  async loadEntity(entityId: string): Promise<IdentityEntityRow> {
    const { data, error } = await this.client
      .from("entities")
      .select("id, kind, primary_identifier, profile, created_at")
      .eq("id", entityId)
      .maybeSingle();

    return mapEntity(data, error, "Failed to load entity");
  }

  async listEntitlements(entityId: string): Promise<EntitlementRow[]> {
    const { data, error } = await this.client
      .from("entitlements")
      .select("entity_id, code, source, granted_at")
      .eq("entity_id", entityId);

    if (error) {
      throw new Error(`Failed to load entitlements: ${error.message}`);
    }

    return data ?? [];
  }

  async upsertEntitlement(input: EntitlementInsert): Promise<void> {
    const { error } = await this.client
      .from("entitlements")
      .upsert(input, { onConflict: "entity_id,code" });

    if (error) {
      throw new Error(`Failed to upsert entitlement: ${error.message}`);
    }
  }
}

export function createSupabaseIdentifierResolverStore(
  client: SupabaseClient<IdentityDatabase>,
): IdentifierResolverStore {
  return new SupabaseIdentifierResolverStore(client);
}

export const internal = {
  normalizeIdentifier,
  seniorEligible,
  storeValue,
};
