import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

type QueryResult<T> = Promise<{ data: T; error: null }>;

class ManifestSupabaseMock {
  shiftRow = {
    id: "shift-1",
    branch_id: "branch-1",
    cashier_entity_id: "cashier-1",
    opened_at: new Date().toISOString(),
    closed_at: null as string | null,
    verified_at: null as string | null,
    status: "OPEN",
    opening_float_json: { 100: 1, 50: 2 },
  };

  submissionRow = {
    id: "submission-1",
    submitted_by: "cashier-1",
    submitted_at: new Date().toISOString(),
    denominations_json: { 100: 2, 50: 2 },
    total_submitted: 300,
    notes: "End of day drop",
  };

  verificationRow = {
    id: "verification-1",
    verified_by: "supervisor-1",
    verified_at: new Date().toISOString(),
    denominations_json: { 100: 2, 20: 5 },
    total_counted: 295,
    variance_amount: 5,
    variance_type: "SHORT",
    resolution: "PAID_NOW",
    resolution_meta: { method: "cash" },
    notes: "Paid immediately",
  };

  poolRow = { balance_amount: 42 };

  from(table: string) {
    if (table === "pos_shifts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async (): QueryResult<typeof this.shiftRow> => ({
              data: this.shiftRow,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "pos_shift_submissions") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async (): QueryResult<typeof this.submissionRow> => ({
                  data: this.submissionRow,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "pos_shift_verifications") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async (): QueryResult<typeof this.verificationRow> => ({
                  data: this.verificationRow,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "pos_overage_pool") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async (): QueryResult<typeof this.poolRow> => ({
                data: this.poolRow,
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }
}

const supabase = new ManifestSupabaseMock();

mock.module("@/lib/supabase/server", {
  namedExports: {
    createServerSupabaseClient: async () => supabase,
  },
});

const { GET } = await import("../route");

describe("GET /api/pos/shift/[id]/manifest", () => {
  it("returns the manifest summary", async () => {
    const response = await GET(
      new Request("http://localhost/api/pos/shift/shift-1") as unknown as NextRequest,
      { params: Promise.resolve({ id: "shift-1" }) },
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as Record<string, unknown>;
    const shift = payload.shift as Record<string, unknown>;
    assert.equal(shift.id, "shift-1");
    assert.equal(payload.overagePoolBalance, 42);

    const submission = payload.submission as Record<string, unknown>;
    assert.equal(submission?.total, 300);

    const verification = payload.verification as Record<string, unknown>;
    assert.equal(verification?.varianceAmount, 5);
  });
});
