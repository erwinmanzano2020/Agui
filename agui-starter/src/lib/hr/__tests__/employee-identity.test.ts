import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Database } from "@/lib/db.types";
import { findOrCreateEntityForEmployee } from "@/lib/hr/employee-identity";

type IdentifierRow = {
  entity_id: string;
  identifier_type?: string;
  identifier_value?: string;
  is_primary?: boolean;
  kind?: string;
  value_norm?: string;
};

class EntityIdentifierQueryMock {
  constructor(
    private rows: IdentifierRow[],
    private allowedColumns: Set<string>,
    private filters: Record<string, string> = {},
    private error: { message: string } | null = null,
  ) {}

  select() {
    return this;
  }

  eq(column: keyof IdentifierRow, value: string) {
    if (!this.allowedColumns.has(column as string)) {
      return new EntityIdentifierQueryMock(this.rows, this.allowedColumns, this.filters, {
        message: `column ${String(column)} does not exist`,
      });
    }
    return new EntityIdentifierQueryMock(
      this.rows,
      this.allowedColumns,
      { ...this.filters, [column]: value },
      this.error,
    );
  }

  async maybeSingle() {
    if (this.error) {
      return { data: null, error: this.error } as const;
    }
    const match = this.rows.find((row) => {
      const candidate = row as Record<string, unknown>;
      return Object.entries(this.filters).every(([key, value]) => candidate[key] === value);
    });
    return { data: (match as never) ?? null, error: null } as const;
  }
}

class EntityIdentifierTableMock {
  constructor(private rows: IdentifierRow[], private allowedColumns: Set<string>) {}

  select() {
    return new EntityIdentifierQueryMock(this.rows, this.allowedColumns);
  }

  insert(payloads: Record<string, unknown>[]) {
    for (const payload of payloads) {
      for (const key of Object.keys(payload)) {
        if (!this.allowedColumns.has(key)) {
          return { error: { message: `column ${key} does not exist` } } as const;
        }
      }
      this.rows.push(payload as IdentifierRow);
    }
    return { error: null } as const;
  }
}

type EntityRow = { id: string; display_name: string | null };

class EntityTableMock {
  constructor(private rows: EntityRow[]) {}

  insert(payload: { display_name: string }) {
    const row: EntityRow = { id: `entity-${this.rows.length + 1}`, display_name: payload.display_name };
    this.rows.push(row);
    return {
      select: () => ({
        single: async () => ({ data: row, error: null } as const),
      }),
    };
  }
}

class SupabaseIdentityMock {
  constructor(
    private identifiers: IdentifierRow[],
    private allowedIdentifierColumns: string[],
    private entities: EntityRow[] = [],
  ) {}

  from(table: keyof Database["public"]["Tables"]) {
    if (table === "entity_identifiers") {
      return new EntityIdentifierTableMock(this.identifiers, new Set(this.allowedIdentifierColumns));
    }
    if (table === "entities") {
      return new EntityTableMock(this.entities);
    }
    throw new Error(`Unexpected table ${String(table)}`);
  }
}

describe("findOrCreateEntityForEmployee", () => {
  it("returns null when no contact info is provided", async () => {
    const identifiers: IdentifierRow[] = [];
    const entities: EntityRow[] = [];
    const supabase = new SupabaseIdentityMock(identifiers, ["entity_id", "identifier_type", "identifier_value"], entities);

    const result = await findOrCreateEntityForEmployee(supabase as never, { fullName: "No Contact" });

    assert.equal(result.entityId, null);
    assert.equal(entities.length, 0);
    assert.equal(identifiers.length, 0);
  });

  it("links to an existing entity when the identifier already exists", async () => {
    const identifiers: IdentifierRow[] = [
      { entity_id: "entity-123", identifier_type: "EMAIL", identifier_value: "person@example.com", is_primary: true },
    ];
    const entities: EntityRow[] = [];
    const supabase = new SupabaseIdentityMock(identifiers, ["entity_id", "identifier_type", "identifier_value", "is_primary"], entities);

    const result = await findOrCreateEntityForEmployee(supabase as never, {
      fullName: "Existing Person",
      email: "person@example.com",
      phone: "09171234567",
    });

    assert.equal(result.entityId, "entity-123");
    assert.equal(entities.length, 0);
    assert.equal(identifiers.length, 1);
  });

  it("creates an entity and identifier records when no match exists", async () => {
    const identifiers: IdentifierRow[] = [];
    const entities: EntityRow[] = [];
    const supabase = new SupabaseIdentityMock(identifiers, ["entity_id", "identifier_type", "identifier_value", "is_primary"], entities);

    const result = await findOrCreateEntityForEmployee(supabase as never, {
      fullName: "New Person",
      email: "new.person@example.com",
      phone: "0917-123-4567",
    });

    assert.ok(result.entityId);
    assert.equal(entities.length, 1);
    assert.equal(identifiers.length, 2);
    const emailRow = identifiers.find((row) => row.identifier_type === "EMAIL");
    const phoneRow = identifiers.find((row) => row.identifier_type === "PHONE");
    assert.ok(emailRow);
    assert.ok(phoneRow);
    assert.equal(emailRow?.is_primary, true);
    assert.equal(phoneRow?.is_primary, false);
  });

  it("falls back to legacy identifier columns when identifier_type is unavailable", async () => {
    const identifiers: IdentifierRow[] = [{ entity_id: "entity-legacy", kind: "email", value_norm: "legacy@example.com" }];
    const entities: EntityRow[] = [];
    const supabase = new SupabaseIdentityMock(identifiers, ["entity_id", "kind", "value_norm"], entities);

    const result = await findOrCreateEntityForEmployee(supabase as never, {
      fullName: "Legacy Person",
      email: "legacy@example.com",
    });

    assert.equal(result.entityId, "entity-legacy");
    assert.equal(entities.length, 0);
    assert.equal(identifiers.length, 1);
  });
});
