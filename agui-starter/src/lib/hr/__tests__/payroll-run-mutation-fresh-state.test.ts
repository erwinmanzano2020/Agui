import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAdjustmentRunForHouse,
  finalizePayrollRunForHouse,
  markPayrollRunPaidForHouse,
  PayrollRunOpenSegmentsError,
  PayrollRunWrongStatusError,
  type PayrollRunStatus,
  type PayrollRunWriteTarget,
} from "@/lib/hr/payroll-runs-server";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "22222222-2222-4222-8222-222222222222";

type MockRun = {
  id: string;
  house_id: string;
  period_start: string;
  period_end: string;
  status: PayrollRunStatus;
};

function createMutationSupabaseMock(run: MockRun, options: { openSegmentsForFreshRange?: boolean } = {}) {
  const gteValues: string[] = [];
  const lteValues: string[] = [];

  const supabase = {
    from: (table: string) => {
      if (table === "hr_payroll_runs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: run, error: null }),
            }),
          }),
        };
      }

      if (table === "dtr_segments") {
        return {
          select: () => ({
            eq: () => ({
              gte: (_field: string, value: string) => {
                gteValues.push(value);
                return {
                  lte: (_lteField: string, lteValue: string) => {
                    lteValues.push(lteValue);
                    return {
                      not: () => ({
                        is: () => ({
                          eq: () => ({
                            limit: async () => {
                              const isFreshRange = value === run.period_start && lteValue === run.period_end;
                              const hasOpen = Boolean(options.openSegmentsForFreshRange && isFreshRange);
                              return { data: hasOpen ? [{ id: "open-1" }] : [], error: null };
                            },
                          }),
                        }),
                      }),
                    };
                  },
                };
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as never;

  return { supabase, gteValues, lteValues };
}

describe("payroll run mutation helpers validate fresh state even with resolvedTarget", () => {
  it("finalize uses fresh status and rejects stale resolvedTarget status", async () => {
    const { supabase } = createMutationSupabaseMock({
      id: RUN_ID,
      house_id: HOUSE_ID,
      period_start: "2026-01-01",
      period_end: "2026-01-15",
      status: "posted",
    });

    const staleResolvedTarget: PayrollRunWriteTarget = {
      id: RUN_ID,
      houseId: HOUSE_ID,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-15",
      status: "draft",
    };

    await assert.rejects(
      () =>
        finalizePayrollRunForHouse(supabase, HOUSE_ID, RUN_ID, {
          access: { allowed: true, entityId: "entity-1" } as never,
          resolvedTarget: staleResolvedTarget,
        }),
      (error: unknown) => error instanceof PayrollRunWrongStatusError,
    );
  });

  it("mark-paid uses fresh status and rejects stale resolvedTarget status", async () => {
    const { supabase } = createMutationSupabaseMock({
      id: RUN_ID,
      house_id: HOUSE_ID,
      period_start: "2026-01-01",
      period_end: "2026-01-15",
      status: "draft",
    });

    const staleResolvedTarget: PayrollRunWriteTarget = {
      id: RUN_ID,
      houseId: HOUSE_ID,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-15",
      status: "posted",
    };

    await assert.rejects(
      () =>
        markPayrollRunPaidForHouse(
          supabase,
          { houseId: HOUSE_ID, runId: RUN_ID },
          {
            access: { allowed: true, entityId: "entity-1" } as never,
            resolvedTarget: staleResolvedTarget,
          },
        ),
      (error: unknown) => error instanceof PayrollRunWrongStatusError,
    );
  });

  it("adjustments use fresh status and reject stale resolvedTarget status", async () => {
    const { supabase } = createMutationSupabaseMock({
      id: RUN_ID,
      house_id: HOUSE_ID,
      period_start: "2026-01-01",
      period_end: "2026-01-15",
      status: "draft",
    });

    const staleResolvedTarget: PayrollRunWriteTarget = {
      id: RUN_ID,
      houseId: HOUSE_ID,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-15",
      status: "posted",
    };

    await assert.rejects(
      () =>
        createAdjustmentRunForHouse(
          supabase,
          { houseId: HOUSE_ID, adjustsRunId: RUN_ID },
          {
            access: { allowed: true, entityId: "entity-1" } as never,
            resolvedTarget: staleResolvedTarget,
          },
        ),
      (error: unknown) => error instanceof PayrollRunWrongStatusError,
    );
  });

  it("finalize evaluates open segments using fresh run period, not stale resolvedTarget period", async () => {
    const freshRun = {
      id: RUN_ID,
      house_id: HOUSE_ID,
      period_start: "2026-02-01",
      period_end: "2026-02-15",
      status: "draft" as const,
    };
    const { supabase, gteValues, lteValues } = createMutationSupabaseMock(freshRun, {
      openSegmentsForFreshRange: true,
    });

    const staleResolvedTarget: PayrollRunWriteTarget = {
      id: RUN_ID,
      houseId: HOUSE_ID,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-15",
      status: "draft",
    };

    await assert.rejects(
      () =>
        finalizePayrollRunForHouse(supabase, HOUSE_ID, RUN_ID, {
          access: { allowed: true, entityId: "entity-1" } as never,
          resolvedTarget: staleResolvedTarget,
        }),
      (error: unknown) => error instanceof PayrollRunOpenSegmentsError,
    );

    assert.deepEqual(gteValues, [freshRun.period_start]);
    assert.deepEqual(lteValues, [freshRun.period_end]);
  });
});
