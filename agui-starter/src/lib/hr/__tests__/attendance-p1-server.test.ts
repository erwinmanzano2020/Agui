import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listCanonicalAttendanceForDate,
} from "@/lib/hr/attendance-p1-server";
import type { Database } from "@/lib/db.types";
import type { HrBranchAccessDecision } from "@/lib/hr/access";
import type { SupabaseClient } from "@supabase/supabase-js";

function row(index: number) {
  return {
    fact_id: `fact-${index}`,
    employee_id: `employee-${index}`,
    work_date: "2026-09-25",
    time_in: "2026-09-25T08:00:00+08:00",
    time_out: "2026-09-25T17:00:00+08:00",
    hours_worked: 8,
    overtime_minutes: 0,
    status: "closed",
    attribution_state: "ATTRIBUTED",
    active_branch_id: "branch-1",
  };
}

describe("Historical DTR P1 canonical reader adapter", () => {
  it("paginates until the complete Daily DTR fact set is loaded", async () => {
    const offsets: number[] = [];
    const firstPage = Array.from({ length: 200 }, (_, index) => row(index));
    const secondPage = [row(200)];

    const supabase = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        const offset = Number(args.p_offset ?? 0);
        offsets.push(offset);
        return {
          data: offset === 0 ? firstPage : secondPage,
          error: null,
        };
      },
    } as unknown as SupabaseClient<Database>;

    const access = {
      allowed: true,
      isBranchLimited: true,
      allowedBranchIds: ["branch-1"],
    } as HrBranchAccessDecision;

    const result = await listCanonicalAttendanceForDate(
      supabase,
      "house-1",
      "2026-09-25",
      access,
    );

    assert.equal(result.length, 201);
    assert.deepEqual(offsets, [0, 200]);
    assert.equal(result[200]?.fact_id, "fact-200");
  });

  it("does not call a canonical reader when HR access is denied", async () => {
    let called = false;
    const supabase = {
      rpc: async () => {
        called = true;
        return { data: [], error: null };
      },
    } as unknown as SupabaseClient<Database>;

    const result = await listCanonicalAttendanceForDate(
      supabase,
      "house-1",
      "2026-09-25",
      { allowed: false } as HrBranchAccessDecision,
    );

    assert.deepEqual(result, []);
    assert.equal(called, false);
  });
});
