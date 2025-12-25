import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findOrCreateEntityForEmployee, normalizeEmployeePhoneDetails } from "@/lib/hr/employee-identity";

class SupabaseRpcMock {
  calls: Array<{ name: string; params: Record<string, unknown> }> = [];

  constructor(
    private handler: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>,
  ) {}

  rpc(name: string, params: Record<string, unknown>) {
    this.calls.push({ name, params });
    return this.handler(name, params);
  }
}

describe("findOrCreateEntityForEmployee", () => {
  it("returns null when no contact info is provided", async () => {
    const supabase = new SupabaseRpcMock(async () => ({ data: null, error: null }));

    const result = await findOrCreateEntityForEmployee(supabase as never, { houseId: "house-1", fullName: "No Contact" });

    assert.equal(result.entityId, null);
    assert.equal(supabase.calls.length, 0);
  });

  it("links to an existing entity when the identifier already exists", async () => {
    const supabase = new SupabaseRpcMock(async (_name, params) => {
      assert.equal(params.p_house_id, "house-1");
      const identifiers = params.p_identifiers as Array<{ identifier_type: string; identifier_value: string }>;
      assert.deepEqual(identifiers, [
        { identifier_type: "EMAIL", identifier_value: "person@example.com" },
        { identifier_type: "PHONE", identifier_value: "+639171234567" },
        { identifier_type: "PHONE", identifier_value: "09171234567" },
      ]);
      return { data: "entity-123", error: null };
    });

    const result = await findOrCreateEntityForEmployee(supabase as never, {
      houseId: "house-1",
      fullName: "Existing Person",
      email: "person@example.com",
      phone: "09171234567",
    });

    assert.equal(result.entityId, "entity-123");
    assert.equal(supabase.calls.length, 1);
  });

  it("creates an entity and identifier records when no match exists", async () => {
    const supabase = new SupabaseRpcMock(async () => {
      return { data: "entity-new", error: null };
    });

    const result = await findOrCreateEntityForEmployee(supabase as never, {
      houseId: "house-1",
      fullName: "New Person",
      email: "new.person@example.com",
      phone: "0917-123-4567",
    });

    assert.equal(result.entityId, "entity-new");
    assert.equal(supabase.calls.length, 1);
  });

  it("falls back to legacy identifier columns when identifier_type is unavailable", async () => {
    const supabase = new SupabaseRpcMock(async () => ({ data: "entity-legacy", error: null }));

    const result = await findOrCreateEntityForEmployee(supabase as never, {
      houseId: "house-1",
      fullName: "Legacy Person",
      email: "legacy@example.com",
    });

    assert.equal(result.entityId, "entity-legacy");
    assert.equal(supabase.calls.length, 1);
  });

  it("matches legacy phone identifiers before creating new entities", async () => {
    const supabase = new SupabaseRpcMock(async (_name, params) => {
      const identifiers = (params as { p_identifiers?: Array<{ identifier_value: string }> }).p_identifiers ?? [];
      const phones = identifiers.map((item) => item.identifier_value);
      const normalized = normalizeEmployeePhoneDetails(phones[0] ?? null);
      const legacy = normalized?.legacyLocal ?? null;
      return { data: legacy === "09171234567" ? "entity-legacy" : "entity-new", error: null };
    });

    for (const phone of ["+639171234567", "639171234567", "09171234567", "9171234567"]) {
      const result = await findOrCreateEntityForEmployee(supabase as never, {
        houseId: "house-1",
        fullName: "Phone Legacy",
        phone,
      });

      assert.equal(result.entityId, "entity-legacy");
    }
    assert.equal(supabase.calls.length, 4);
  });

  it("propagates authorization errors from the RPC", async () => {
    const supabase = new SupabaseRpcMock(async () => ({
      data: null,
      error: { message: "Not allowed to manage identities for this house" },
    }));

    await assert.rejects(() =>
      findOrCreateEntityForEmployee(supabase as never, {
        houseId: "house-1",
        fullName: "Blocked",
        phone: "09171234567",
      }),
    );
  });
});
