import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSupabaseKioskRepo } from "@/lib/hr/kiosk/repository";

describe("kiosk repository", () => {
  it("updates last_event_at after event write", async () => {
    const calls: Array<{ table: string; action: string; payload?: Record<string, unknown> }> = [];

    const supabase = {
      from(table: string) {
        return {
          insert(payload: Record<string, unknown>) {
            calls.push({ table, action: "insert", payload });
            return Promise.resolve({ error: null });
          },
          update(payload: Record<string, unknown>) {
            calls.push({ table, action: "update", payload });
            return {
              eq() {
                return this;
              },
            };
          },
        };
      },
    };

    const repo = createSupabaseKioskRepo(supabase as never);
    await repo.insertKioskEvent({
      deviceId: "device-1",
      houseId: "house-1",
      branchId: "branch-1",
      eventType: "scan",
      occurredAt: "2026-02-01T09:00:00+08:00",
      metadata: {},
    });

    assert.equal(calls[0]?.table, "hr_kiosk_events");
    assert.equal(calls[1]?.table, "hr_kiosk_devices");
    assert.equal(calls[1]?.payload?.last_event_at, "2026-02-01T09:00:00+08:00");
  });
});
