import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSupabaseKioskRepo } from "@/lib/hr/kiosk/repository";

describe("kiosk repository", () => {
  it("routes telemetry touch through the bounded telemetry RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return { data: null, error: null };
      },
      from() {
        throw new Error("telemetry touch must not use raw table mutation");
      },
    };

    const repo = createSupabaseKioskRepo(supabase as never);
    await repo.touchDevice("device-1");

    assert.deepEqual(calls, [
      {
        name: "hr_touch_kiosk_device_telemetry",
        args: { p_device_id: "device-1" },
      },
    ]);
  });

  it("routes support events through the bounded event RPC without caller House/branch", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return { data: null, error: null };
      },
      from() {
        throw new Error("support event must not use raw table mutation");
      },
    };

    const repo = createSupabaseKioskRepo(supabase as never);
    await repo.insertKioskEvent({
      deviceId: "device-1",
      houseId: "house-untrusted",
      branchId: "branch-untrusted",
      employeeId: "employee-1",
      eventType: "sync_success",
      occurredAt: "2026-02-01T09:00:00+08:00",
      metadata: { clientEventId: "evt-1" },
    });

    assert.deepEqual(calls, [
      {
        name: "hr_record_kiosk_support_event",
        args: {
          p_device_id: "device-1",
          p_employee_id: "employee-1",
          p_event_type: "sync_success",
          p_occurred_at: "2026-02-01T09:00:00+08:00",
          p_metadata: { clientEventId: "evt-1" },
        },
      },
    ]);
    assert.equal("p_house_id" in calls[0]!.args, false);
    assert.equal("p_branch_id" in calls[0]!.args, false);
  });
});
