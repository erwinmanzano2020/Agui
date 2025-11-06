import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  EntityIdentifierRow,
  EntityRow,
  EntitlementRow,
} from "@/lib/db.types";

import {
  type IdentifierInput,
  type IdentifierResolverStore,
  type ResolverOptions,
  fingerprintIdentifier,
  normalizeIdentifier,
  resolveIdentifier,
} from "../identifier-resolver";

class InMemoryStore implements IdentifierResolverStore {
  private entitySeq = 0;
  private identifierSeq = 0;
  private entities = new Map<string, EntityRow>();
  private identifiers = new Map<string, EntityIdentifierRow>();
  private entitlements: EntitlementRow[] = [];

  async findByFingerprint(kind: EntityIdentifierRow["kind"], fingerprint: string) {
    for (const identifier of this.identifiers.values()) {
      if (identifier.kind === kind && identifier.fingerprint === fingerprint) {
        return identifier;
      }
    }
    return null;
  }

  async createEntity(args: {
    kind: EntityIdentifierRow["kind"];
    normalizedValue: string;
    displayName?: string | null;
    profile?: Record<string, unknown> | null;
  }) {
    const id = `ent-${++this.entitySeq}`;
    const row: EntityRow = {
      id,
      display_name: args.displayName ?? args.normalizedValue,
      profile: (args.profile ?? {}) as unknown as EntityRow["profile"],
      is_gm: false,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    this.entities.set(id, row);
    return row;
  }

  async linkIdentifier(args: {
    entityId: string;
    kind: EntityIdentifierRow["kind"];
    normalizedValue: string;
    fingerprint: string;
    meta?: Record<string, unknown> | null;
    verification?: ResolverOptions["verification"];
  }) {
    const id = `ident-${++this.identifierSeq}`;
    const identifier: EntityIdentifierRow = {
      id,
      entity_id: args.entityId,
      kind: args.kind,
      issuer: null,
      value_norm: args.normalizedValue,
      fingerprint: args.fingerprint,
      meta: (args.meta ?? {}) as unknown as EntityIdentifierRow["meta"],
      verified_at: args.verification?.verified
        ? args.verification?.verifiedAt ?? new Date().toISOString()
        : null,
      added_by_entity_id: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    this.identifiers.set(id, identifier);
    return identifier;
  }

  async loadEntity(entityId: string) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`entity ${entityId} missing`);
    return entity;
  }

  async listEntitlements(entityId: string) {
    return this.entitlements.filter((ent) => ent.entity_id === entityId);
  }

  async ensureEntitlement(
    entityId: string,
    code: string,
    source: string,
    context: Record<string, unknown>,
  ) {
    const existing = this.entitlements.find(
      (ent) => ent.entity_id === entityId && ent.code === code,
    );

    if (existing) {
      existing.source = source;
      existing.granted_at = new Date().toISOString();
      existing.meta = context as unknown as EntitlementRow["meta"];
      return;
    }

    const entitlement: EntitlementRow = {
      entity_id: entityId,
      code,
      source,
      granted_at: new Date().toISOString(),
      meta: context as unknown as EntitlementRow["meta"],
    };
    this.entitlements.push(entitlement);
  }
}

const resolveWithStore = (store: InMemoryStore, input: IdentifierInput, options?: ResolverOptions) =>
  resolveIdentifier(store, input, options);

describe("identifier resolver", () => {
  it("creates a new entity when identifier is unknown", async () => {
    const store = new InMemoryStore();
    const input: IdentifierInput = {
      kind: "email",
      value: " NewUser@Example.com ",
    };

    const result = await resolveWithStore(store, input);

    assert.equal(result.created, true);
    assert.equal(result.identifier.value_norm, "newuser@example.com");
    assert.equal(result.identifier.fingerprint, "newuser@example.com");
    assert.equal(result.entity.display_name, "newuser@example.com");
    assert.deepEqual(result.entitlements, []);
  });

  it("reuses an existing entity for duplicate identifiers", async () => {
    const store = new InMemoryStore();
    const normalized = normalizeIdentifier("phone", "(0917) 000-1111");
    const fingerprint = fingerprintIdentifier("phone", normalized);
    const first = await resolveWithStore(store, { kind: "phone", value: "(0917) 000-1111" });

    assert.equal(first.created, true);

    // Emulate a second resolution that should reuse the same entity
    const second = await resolveWithStore(store, { kind: "phone", value: "09170001111" });

    assert.equal(second.created, false);
    assert.equal(second.entity.id, first.entity.id);
    assert.equal(second.identifier.fingerprint, fingerprint);
  });

  it("grants senior entitlement when gov_id is verified", async () => {
    const store = new InMemoryStore();
    const input: IdentifierInput = {
      kind: "gov_id",
      value: "SENIOR-1234",
      meta: { senior: true },
    };

    const result = await resolveWithStore(store, input, {
      verification: { verified: true },
    });

    const senior = result.entitlements.find((ent) => ent.code === "senior");
    assert.ok(senior, "expected senior entitlement to be granted");
    assert.equal(senior?.source, "gov_id_auto");
  });
});
