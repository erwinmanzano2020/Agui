import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HrOvertimePolicyRow } from "@/lib/db.types";
import { evaluateHrAccess } from "../access";
import {
  getOvertimePolicyForHouse,
  OvertimePolicyError,
  upsertOvertimePolicy,
} from "../overtime-policy-server";

type Filter<T> = (row: T) => boolean;

class PolicyQueryMock {
  constructor(
    private rows: HrOvertimePolicyRow[],
    private filters: Filter<HrOvertimePolicyRow>[] = [],
    private onUpsert?: (payload: HrOvertimePolicyRow) => void,
  ) {}

  select() {
    return this;
  }

  eq(column: keyof HrOvertimePolicyRow, value: string) {
    return new PolicyQueryMock(
      this.rows,
      [...this.filters, (row) => String(row[column]) === value],
      this.onUpsert,
    );
  }

  async maybeSingle<T>() {
    const filtered = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    return { data: (filtered[0] as T | null) ?? null, error: null } as const;
  }

  upsert(payload: HrOvertimePolicyRow) {
    return new PolicyUpsertMock(payload, this.onUpsert);
  }
}

class PolicyUpsertMock {
  constructor(
    private payload: HrOvertimePolicyRow,
    private onUpsert?: (payload: HrOvertimePolicyRow) => void,
  ) {
    this.onUpsert?.(payload);
  }

  select() {
    return this;
  }

  async maybeSingle<T>() {
    return { data: this.payload as T, error: null } as const;
  }
}

class SupabaseMock {
  public lastUpsert: HrOvertimePolicyRow | null = null;

  constructor(private data: { policies: HrOvertimePolicyRow[] }) {}

  from(table: string) {
    if (table === "hr_overtime_policies") {
      return new PolicyQueryMock(this.data.policies, [], (payload) => {
        this.lastUpsert = payload;
      });
    }
    throw new Error(`Unexpected table ${table}`);
  }
}

const accessAllowed = evaluateHrAccess({ roles: ["house_owner"], policyKeys: [], entityId: "entity-1" });
const accessDenied = evaluateHrAccess({ roles: [], policyKeys: [], entityId: null });

describe("getOvertimePolicyForHouse", () => {
  it("returns null when access is denied", async () => {
    const supabase = new SupabaseMock({ policies: [] });

    const result = await getOvertimePolicyForHouse(supabase as never, "house-1", {
      access: accessDenied,
    });

    assert.equal(result, null);
  });
});

describe("upsertOvertimePolicy", () => {
  it("upserts a new policy row when none exists", async () => {
    const supabase = new SupabaseMock({ policies: [] });

    const result = await upsertOvertimePolicy(
      supabase as never,
      {
        houseId: "house-1",
        minOtMinutes: 15,
        roundingMinutes: 5,
        roundingMode: "FLOOR",
        timezone: "Asia/Manila",
      },
      { access: accessAllowed },
    );

    assert.ok(supabase.lastUpsert);
    assert.equal(supabase.lastUpsert?.house_id, "house-1");
    assert.equal(supabase.lastUpsert?.min_ot_minutes, 15);
    assert.equal(supabase.lastUpsert?.rounding_minutes, 5);
    assert.equal(supabase.lastUpsert?.rounding_mode, "FLOOR");
    assert.ok(supabase.lastUpsert?.created_at);
    assert.equal(result.house_id, "house-1");
    assert.equal(result.ot_mode, "AFTER_SCHEDULE_END");
  });

  it("throws when access is denied", async () => {
    const supabase = new SupabaseMock({ policies: [] });

    await assert.rejects(
      () =>
        upsertOvertimePolicy(
          supabase as never,
          {
            houseId: "house-1",
            minOtMinutes: 10,
            roundingMinutes: 1,
            roundingMode: "NONE",
            timezone: "Asia/Manila",
          },
          { access: accessDenied },
        ),
      OvertimePolicyError,
    );
  });
});
