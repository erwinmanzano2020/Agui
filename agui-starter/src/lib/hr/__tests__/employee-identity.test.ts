import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findOrCreateEntityForEmployee,
  getIdentitySummariesForEmployees,
  lookupEntitiesForEmployee,
  normalizeEmployeePhoneDetails,
} from "@/lib/hr/employee-identity";

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
      assert.equal(params.p_email, "person@example.com");
      assert.equal(params.p_phone, "+639171234567");
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
      const phone = (params as { p_phone?: string | null }).p_phone ?? null;
      const normalized = normalizeEmployeePhoneDetails(phone);
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

  it("surfaces schema cache errors with actionable text", async () => {
    const supabase = new SupabaseRpcMock(async () => ({
      data: null,
      error: { message: "Could not find the function hr_find_or_create_entity_for_employee in the schema cache" },
    }));

    await assert.rejects(
      () =>
        findOrCreateEntityForEmployee(supabase as never, {
          houseId: "house-1",
          fullName: "Missing RPC",
          email: "missing@example.com",
        }),
      /legacy signature/i,
    );
  });
});

describe("lookupEntitiesForEmployee", () => {
  it("returns matches with masked identifiers", async () => {
    const supabase = new SupabaseRpcMock(async (name, params) => {
      assert.equal(name, "hr_lookup_entities_by_identifiers");
      assert.equal(params.p_house_id, "house-1");
      assert.deepEqual(params.p_identifiers, { email: "person@example.com", phone: "+639171234567" });
      return {
        data: [
          {
            entity_id: "entity-1",
            display_name: "Existing",
            matched_identifiers: [{ type: "EMAIL", value_masked: "p***@example.com" }],
            match_confidence: "single",
          },
        ],
        error: null,
      };
    });

    const matches = await lookupEntitiesForEmployee(supabase as never, {
      houseId: "house-1",
      email: "person@example.com",
      phone: "+63 917 123 4567",
    });

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.entityId, "entity-1");
    assert.equal(matches[0]?.matchConfidence, "single");
  });

  it("skips RPC when no identifiers are provided", async () => {
    const supabase = new SupabaseRpcMock(async () => ({ data: [], error: null }));
    const matches = await lookupEntitiesForEmployee(supabase as never, { houseId: "house-1" });
    assert.equal(matches.length, 0);
    assert.equal(supabase.calls.length, 0);
  });

  it("surfaces schema cache errors with actionable text", async () => {
    const supabase = new SupabaseRpcMock(async () => ({
      data: null,
      error: { message: "Could not find the function hr_lookup_entities_by_identifiers in the schema cache" },
    }));

    await assert.rejects(
      () => lookupEntitiesForEmployee(supabase as never, { houseId: "house-1", email: "a@b.com" }),
      /legacy signature/i,
    );
  });

  it("maps missing kind column errors to actionable messages", async () => {
      const supabase = new SupabaseRpcMock(async () => ({
        data: null,
        error: { message: 'column "kind" of relation "entity_identifiers" does not exist' },
      }));

    await assert.rejects(
      () => lookupEntitiesForEmployee(supabase as never, { houseId: "house-1", email: "person@example.com" }),
      /identifier_type\/identifier_value/,
    );
  });

  it("matches phone identifiers with local and E.164 forms", async () => {
    const supabase = new SupabaseRpcMock(async (_name, params) => {
      const phone = (params as { p_identifiers?: { phone?: string } }).p_identifiers?.phone;
      return {
        data: [
          {
            entity_id: phone === "+639171234567" ? "entity-e164" : "entity-local",
            display_name: "Match",
            matched_identifiers: [{ type: "PHONE", value_masked: "•••4567" }],
            match_confidence: "single",
          },
        ],
        error: null,
      };
    });

    const e164Match = await lookupEntitiesForEmployee(supabase as never, {
      houseId: "house-1",
      phone: "+63 917 123 4567",
    });
    assert.equal(e164Match[0]?.entityId, "entity-e164");

    const localMatch = await lookupEntitiesForEmployee(supabase as never, {
      houseId: "house-1",
      phone: "09171234567",
    });
    assert.equal(localMatch[0]?.entityId, "entity-e164");
  });
});

describe("getIdentitySummariesForEmployees", () => {
  it("returns summaries for unique entity ids", async () => {
    const supabase = new SupabaseRpcMock(async (name, params) => {
      assert.equal(name, "hr_get_entity_identity_summary");
      assert.deepEqual(params.p_entity_ids, ["entity-1"]);
      return {
        data: [
          {
            entity_id: "entity-1",
            display_name: "Linked Person",
            identifiers: [{ type: "EMAIL", value_masked: "l***@example.com", is_primary: true }],
          },
        ],
        error: null,
      };
    });

    const summaries = await getIdentitySummariesForEmployees(supabase as never, {
      houseId: "house-1",
      entityIds: ["entity-1", "entity-1"],
    });

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.displayName, "Linked Person");
    assert.equal(summaries[0]?.identifiers[0]?.value_masked, "l***@example.com");
  });

  it("ignores identifiers with unknown types from the RPC response", async () => {
    const supabase = new SupabaseRpcMock(async () => {
      return {
        data: [
          {
            entity_id: "entity-1",
            display_name: "Masked",
            identifiers: [
              { type: "EMAIL", value_masked: "m***@example.com", is_primary: true },
              { type: "unknown", value_masked: "should-skip" },
              { type: "phone", value_masked: "•••4567" },
            ],
          },
        ],
        error: null,
      };
    });

    const summaries = await getIdentitySummariesForEmployees(supabase as never, {
      houseId: "house-1",
      entityIds: ["entity-1"],
    });

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.identifiers.length, 2);
    assert.equal(summaries[0]?.identifiers[0]?.type, "EMAIL");
    assert.equal(summaries[0]?.identifiers[1]?.type, "PHONE");
  });

  it("skips RPC for empty entity ids", async () => {
    const supabase = new SupabaseRpcMock(async () => ({ data: [], error: null }));
    const summaries = await getIdentitySummariesForEmployees(supabase as never, { houseId: "house-1", entityIds: [] });
    assert.equal(summaries.length, 0);
    assert.equal(supabase.calls.length, 0);
  });
});
