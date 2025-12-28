import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HrIdentitySummaryRow } from "../identity-summary";
import { fetchIdentitySummary, normalizeIdentitySummary } from "../identity-summary";

class SupabaseMock {
  constructor(
    private payload: { data: HrIdentitySummaryRow[] | null; error: { message: string } | null },
  ) {}

  async rpc<T>(_fn: string, _args: unknown) {
    void _fn;
    void _args;
    return this.payload as { data: T[] | null; error: { message: string } | null };
  }
}

describe("normalizeIdentitySummary", () => {
  it("groups identifiers by entity and sorts primary identifiers first", () => {
    const rows: HrIdentitySummaryRow[] = [
      { entity_id: "ent-1", identifier_type: "PHONE", masked_value: "***1111", is_primary: false },
      { entity_id: "ent-1", identifier_type: "EMAIL", masked_value: "ex***@ample.com", is_primary: true },
      { entity_id: "ent-2", identifier_type: null, masked_value: null, is_primary: null },
    ];

    const summary = normalizeIdentitySummary(rows);

    assert.deepEqual(Object.keys(summary), ["ent-1", "ent-2"]);
    assert.strictEqual(summary["ent-1"]?.[0]?.identifierType, "EMAIL");
    assert.ok(summary["ent-1"]?.[0]?.isPrimary);
    assert.strictEqual(summary["ent-2"]?.[0]?.identifierType, "UNKNOWN");
    assert.strictEqual(summary["ent-2"]?.[0]?.maskedValue, "***");
  });
});

describe("fetchIdentitySummary", () => {
  it("returns normalized identity summaries when RPC succeeds", async () => {
    const supabase = new SupabaseMock({
      data: [{ entity_id: "ent-1", identifier_type: "PHONE", masked_value: "***1111", is_primary: false }],
      error: null,
    });

    const summary = await fetchIdentitySummary(supabase as never, "house-1", ["ent-1"]);

    assert.deepEqual(Object.keys(summary), ["ent-1"]);
    assert.strictEqual(summary["ent-1"]?.[0]?.maskedValue, "***1111");
  });

  it("returns an empty map when no entity ids are provided", async () => {
    const supabase = new SupabaseMock({ data: [], error: null });

    const summary = await fetchIdentitySummary(supabase as never, "house-1", []);

    assert.deepEqual(summary, {});
  });

  it("throws when the RPC returns an error", async () => {
    const supabase = new SupabaseMock({ data: null, error: { message: "rpc failed" } });

    await assert.rejects(
      () => fetchIdentitySummary(supabase as never, "house-1", ["ent-1"]),
      /rpc failed/,
    );
  });
});
