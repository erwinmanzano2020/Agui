import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { PosShiftError, submitBlindDrop } from "@/lib/pos/shifts.server";

type QueryResult<T> = Promise<{ data: T; error: null }>;
type MutationResult = Promise<{ error: { message: string } | null }>;

class MockSupabase {
  shiftRow: {
    id: string;
    branch_id: string;
    cashier_entity_id: string;
    opened_at: string;
    closed_at: string | null;
    verified_at: string | null;
    opening_float_json: Record<string, number>;
    status: "OPEN" | "CLOSED" | "VERIFIED";
  };
  submissionRow: {
    id: string;
    shift_id: string;
    submitted_by: string;
    submitted_at: string;
    denominations_json: Record<string, number>;
    total_submitted: number;
    notes: string | null;
  } | null;
  submissionUpdates: unknown[] = [];
  shiftUpdates: unknown[] = [];
  submissionUpdateError: { message: string } | null = null;
  shiftUpdateError: { message: string } | null = null;

  constructor() {
    this.shiftRow = {
      id: "shift-1",
      branch_id: "branch-1",
      cashier_entity_id: "cashier-1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      verified_at: null,
      opening_float_json: {},
      status: "OPEN",
    };
    this.submissionRow = {
      id: "submission-1",
      shift_id: "shift-1",
      submitted_by: "cashier-1",
      submitted_at: new Date().toISOString(),
      denominations_json: { 100: 1 },
      total_submitted: 100,
      notes: null,
    };
  }

  reset() {
    this.submissionUpdates = [];
    this.shiftUpdates = [];
    this.submissionUpdateError = null;
    this.shiftUpdateError = null;
    this.shiftRow = {
      ...this.shiftRow,
      closed_at: null,
      verified_at: null,
      status: "OPEN",
    };
  }

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
        update: (payload: unknown) => ({
          eq: async (): MutationResult => {
            this.shiftUpdates.push(payload);
            return { error: this.shiftUpdateError };
          },
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
        update: (payload: unknown) => ({
          eq: async (): MutationResult => {
            this.submissionUpdates.push(payload);
            if (this.submissionUpdateError) {
              return { error: this.submissionUpdateError };
            }
            return { error: null };
          },
        }),
        insert: () => ({
          select: () => ({
            single: async (): QueryResult<{ id: string }> => ({
              data: { id: "new-submission" },
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }
}

const supabase = new MockSupabase();
let actorEntityId = "cashier-1";
let actorIsGM = false;

mock.module("@/lib/supabase/server", {
  namedExports: {
    createServerSupabaseClient: async () => supabase,
  },
});

mock.module("@/lib/authz/server", {
  namedExports: {
    getMyEntityId: async () => actorEntityId,
    currentEntityIsGM: async () => actorIsGM,
  },
});

mock.module("@/lib/settings/server", {
  namedExports: {
    getSettingsSnapshot: async () => ({
      "pos.cash.blind_drop_enabled": { value: true },
      "pos.cash.overage_pool.enabled": { value: true },
      "pos.cash.overage_pool.max_offset_ratio": { value: 0.5 },
      "pos.cash.float.defaults": { value: {} },
    }),
  },
});

mock.module("@/lib/events/server", {
  namedExports: {
    emitEvent: async () => {},
  },
});

describe("submitBlindDrop", () => {
  it("allows the cashier to resubmit before verification", async () => {
    actorEntityId = "cashier-1";
    actorIsGM = false;
    supabase.reset();
    supabase.shiftRow = {
      ...supabase.shiftRow,
      cashier_entity_id: "cashier-1",
      status: "OPEN",
    };
    supabase.submissionRow = {
      ...supabase.submissionRow!,
      id: "submission-1",
      submitted_by: "cashier-1",
      total_submitted: 100,
    };

    const result = await submitBlindDrop({
      shiftId: "shift-1",
      denominations: { 100: 2 },
    });

    assert.equal(result.submissionId, "submission-1");
    assert.equal(result.totalSubmitted, 200);
    assert.equal(supabase.submissionUpdates.length, 1);
    assert.equal(supabase.shiftUpdates.length, 1);
  });

  it("rejects updates from a different cashier", async () => {
    actorEntityId = "cashier-2";
    actorIsGM = false;
    supabase.reset();
    supabase.shiftRow = {
      ...supabase.shiftRow,
      cashier_entity_id: "cashier-1",
      status: "OPEN",
    };

    await assert.rejects(
      submitBlindDrop({ shiftId: "shift-1", denominations: { 100: 1 } }),
      (error: unknown) => {
        assert.ok(error instanceof PosShiftError);
        assert.equal(error.status, 403);
        return true;
      },
    );
    assert.equal(supabase.submissionUpdates.length, 0);
    assert.equal(supabase.shiftUpdates.length, 0);
  });
});
