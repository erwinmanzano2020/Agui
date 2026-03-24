import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PayrollRunAccessError,
  resolvePayrollRunWriteTargetForHouseWithAccess,
  type PayrollRunStatus,
} from "@/lib/hr/payroll-runs-server";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_HOUSE_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "22222222-2222-4222-8222-222222222222";

type MockRun = {
  id: string;
  house_id: string;
  period_start: string;
  period_end: string;
  status: PayrollRunStatus;
};

function createSupabaseMock(run: MockRun | null) {
  return {
    from: (table: string) => {
      if (table !== "hr_payroll_runs") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: run, error: null }),
          }),
        }),
      };
    },
  } as never;
}

describe("resolvePayrollRunWriteTargetForHouseWithAccess", () => {
  it("returns minimal write target for allowed in-house run", async () => {
    const supabase = createSupabaseMock({
      id: RUN_ID,
      house_id: HOUSE_ID,
      period_start: "2026-01-01",
      period_end: "2026-01-15",
      status: "posted",
    });

    const result = await resolvePayrollRunWriteTargetForHouseWithAccess(supabase, HOUSE_ID, RUN_ID, {
      access: { allowed: true, entityId: "entity-1" } as never,
    });

    assert.deepEqual(result, {
      id: RUN_ID,
      houseId: HOUSE_ID,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-15",
      status: "posted",
    });
  });

  it("returns null when run is missing", async () => {
    const supabase = createSupabaseMock(null);
    const result = await resolvePayrollRunWriteTargetForHouseWithAccess(supabase, HOUSE_ID, RUN_ID, {
      access: { allowed: true, entityId: "entity-1" } as never,
    });
    assert.equal(result, null);
  });

  it("returns null for cross-house run", async () => {
    const supabase = createSupabaseMock({
      id: RUN_ID,
      house_id: OTHER_HOUSE_ID,
      period_start: "2026-01-01",
      period_end: "2026-01-15",
      status: "draft",
    });

    const result = await resolvePayrollRunWriteTargetForHouseWithAccess(supabase, HOUSE_ID, RUN_ID, {
      access: { allowed: true, entityId: "entity-1" } as never,
    });

    assert.equal(result, null);
  });

  it("throws access error when forbidden", async () => {
    const supabase = createSupabaseMock({
      id: RUN_ID,
      house_id: HOUSE_ID,
      period_start: "2026-01-01",
      period_end: "2026-01-15",
      status: "draft",
    });

    await assert.rejects(
      () =>
        resolvePayrollRunWriteTargetForHouseWithAccess(supabase, HOUSE_ID, RUN_ID, {
          access: { allowed: false, entityId: "entity-1" } as never,
        }),
      (error: unknown) =>
        error instanceof PayrollRunAccessError && /Not allowed to mutate payroll runs/.test(error.message),
    );
  });
});
