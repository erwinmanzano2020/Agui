import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  EntitlementInsert,
  EntitlementRow,
  IdentityEntityInsert,
  IdentityEntityRow,
  IdentifierInsert,
  IdentifierRow,
} from "@/lib/db.types";

import {
  type IdentifierInput,
  type IdentifierResolverStore,
  type ResolverOptions,
  resolveIdentifier,
} from "../identifier-resolver";

class InMemoryStore implements IdentifierResolverStore {
  private entitySeq = 0;
  private identifierSeq = 0;
  private entities = new Map<string, IdentityEntityRow>();
  private identifiers = new Map<string, IdentifierRow>();
  private entitlements: EntitlementRow[] = [];

  async findIdentifier(kind: IdentifierRow["kind"], value: string) {
    for (const identifier of this.identifiers.values()) {
      if (identifier.kind === kind && identifier.value === value) {
        return identifier;
      }
    }
    return null;
  }

  async createEntity(input: IdentityEntityInsert) {
    const id = `ent-${++this.entitySeq}`;
    const row: IdentityEntityRow = {
      id,
      kind: input.kind,
      primary_identifier: input.primary_identifier ?? null,
      profile: (input.profile ?? {}) as IdentityEntityRow["profile"],
      created_at: new Date().toISOString(),
    };
    this.entities.set(id, row);
    return row;
  }

  async updateEntity(entityId: string, patch: Partial<IdentityEntityInsert>) {
    const current = this.entities.get(entityId);
    if (!current) throw new Error(`entity ${entityId} missing`);
    const next = {
      ...current,
      primary_identifier: patch.primary_identifier ?? current.primary_identifier,
    } satisfies IdentityEntityRow;
    this.entities.set(entityId, next);
  }

  async deleteEntity(entityId: string) {
    this.entities.delete(entityId);
  }

  async linkIdentifier(input: IdentifierInsert) {
    for (const identifier of this.identifiers.values()) {
      if (identifier.kind === input.kind && identifier.value === input.value) {
        return identifier;
      }
    }

    const id = `ident-${++this.identifierSeq}`;
    const identifier: IdentifierRow = {
      id,
      entity_id: input.entity_id,
      kind: input.kind,
      value: input.value,
      verified_at: input.verified_at ?? null,
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

  async upsertEntitlement(input: EntitlementInsert) {
    const existing = this.entitlements.find(
      (ent) => ent.entity_id === input.entity_id && ent.code === input.code,
    );

    if (existing) {
      existing.source = input.source ?? existing.source;
      existing.granted_at = new Date().toISOString();
      return;
    }

    const entitlement: EntitlementRow = {
      entity_id: input.entity_id,
      code: input.code,
      source: input.source ?? null,
      granted_at: new Date().toISOString(),
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
    assert.equal(result.identifier.value, "newuser@example.com");
    assert.equal(result.entity.primary_identifier, "newuser@example.com");
    assert.deepEqual(result.entitlements, []);
  });

  it("reuses an existing entity for duplicate identifiers", async () => {
    const store = new InMemoryStore();
    const first = await resolveWithStore(store, { kind: "phone", value: "(0917) 000-1111" });

    assert.equal(first.created, true);

    const second = await resolveWithStore(store, { kind: "phone", value: "09170001111" });

    assert.equal(second.created, false);
    assert.equal(second.entity.id, first.entity.id);
    assert.equal(second.identifier.value, first.identifier.value);
  });

  it("grants senior entitlement when gov_id is verified", async () => {
    const store = new InMemoryStore();
    const input: IdentifierInput = {
      kind: "gov_id",
      value: "SENIOR-1234",
    };

    const result = await resolveWithStore(store, input, {
      verification: { verified: true },
    });

    const senior = result.entitlements.find((ent) => ent.code === "senior");
    assert.ok(senior, "expected senior entitlement to be granted");
    assert.equal(senior?.source, "gov_id_auto");
    assert.match(result.identifier.value, /^gov:/);
  });
});
