import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import { createEmployeeQrToken } from "@/lib/hr/kiosk/qr";
import {
  type KioskDevice,
  type KioskEmployee,
  type KioskRepo,
  type KioskSegment,
  KioskAuthError,
  KioskConflictError,
  processKioskScan,
  processKioskSync,
} from "@/lib/hr/kiosk/service";

describe("kiosk service", () => {
  const houseId = "house-1";
  const branchId = "branch-1";
  const employeeId = "employee-1";
  const kioskToken = "valid-kiosk-token";

  let repo: KioskRepo;
  let devices: KioskDevice[];
  let employees: KioskEmployee[];
  let segments: KioskSegment[];
  let events: Array<{ house_id: string; branch_id: string; device_id: string; employee_id: string | null; event_type: string; occurred_at: string; metadata: Record<string, unknown> }>;
  let touchedDeviceIds: string[];
  let findDeviceByTokenHashCalls: number;

  beforeEach(() => {
    process.env.HR_KIOSK_QR_SECRET = "test-qr-secret";
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";

    devices = [
      {
        id: "device-1",
        house_id: houseId,
        branch_id: branchId,
        is_active: true,
      },
    ];
    employees = [
      {
        id: employeeId,
        house_id: houseId,
        code: "EMP-001",
        full_name: "Edward Mercado",
      },
    ];
    segments = [];
    events = [];
    touchedDeviceIds = [];
    findDeviceByTokenHashCalls = 0;

    repo = {
      async findDeviceByTokenHash(tokenHash) {
        findDeviceByTokenHashCalls += 1;
        const expected = hashKioskToken(kioskToken);
        return tokenHash === expected ? devices[0] : null;
      },
      async touchDevice(deviceId) { touchedDeviceIds.push(deviceId); },
      async findEmployeeById(id) {
        return employees.find((item) => item.id === id) ?? null;
      },
      async findOpenSegments(id) {
        return segments
          .filter((segment) => segment.employee_id === id && segment.status === "open" && !segment.time_out)
          .sort((a, b) => (a.time_in ?? "").localeCompare(b.time_in ?? ""))
          .reverse();
      },
      async closeSegment(segmentId, timeOut) {
        const segment = segments.find((item) => item.id === segmentId) ?? null;
        if (!segment) return null;
        segment.time_out = timeOut;
        segment.status = "closed";
        return segment;
      },
      async createOpenSegment(input) {
        const segment: KioskSegment = {
          id: `segment-${segments.length + 1}`,
          employee_id: input.employeeId,
          house_id: input.houseId,
          work_date: input.workDate,
          time_in: input.timeIn,
          time_out: null,
          status: "open",
        };
        segments.push(segment);
        return segment;
      },
      async findLatestEmployeeEvent(house, id) {
        const event = events
          .filter((item) => item.house_id === house && item.employee_id === id)
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
        return event ? { occurred_at: event.occurred_at } : null;
      },
      async insertKioskEvent(input) {
        events.push({
          house_id: input.houseId,
          branch_id: input.branchId,
          device_id: input.deviceId,
          employee_id: input.employeeId ?? null,
          event_type: input.eventType,
          occurred_at: input.occurredAt,
          metadata: input.metadata ?? {},
        });
      },
      async hasSyncClientEventId(house, branch, clientEventId) {
        return events.some(
          (item) =>
            item.house_id === house &&
            item.branch_id === branch &&
            item.event_type === "sync_success" &&
            String(item.metadata.clientEventId ?? "") === clientEventId,
        );
      },
    };
  });

  it("rejects QR house mismatch", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId: "another-house" });
    await assert.rejects(
      () => processKioskScan(repo, { kioskToken, qrToken }),
      /QR token does not match kiosk house/,
    );
  });

  it("rejects invalid kiosk token", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    await assert.rejects(
      () => processKioskScan(repo, { kioskToken: "bad", qrToken }),
      (error: unknown) => error instanceof KioskAuthError,
    );
  });

  it("toggles open segment on second scan", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    const first = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      occurredAt: "2026-02-01T09:00:00Z",
    });
    assert.equal(first.action, "clock_in");
    assert.equal(segments.filter((segment) => segment.status === "open").length, 1);

    const second = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      occurredAt: "2026-02-01T09:00:20Z",
    });
    assert.equal(second.action, "clock_out");
    assert.equal(segments.filter((segment) => segment.status === "open").length, 0);
  });

  it("closes latest when multiple open segments exist", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    segments.push(
      {
        id: "segment-old",
        employee_id: employeeId,
        house_id: houseId,
        work_date: "2026-02-01",
        time_in: "2026-02-01T08:00:00+08:00",
        time_out: null,
        status: "open",
      },
      {
        id: "segment-new",
        employee_id: employeeId,
        house_id: houseId,
        work_date: "2026-02-01",
        time_in: "2026-02-01T09:00:00+08:00",
        time_out: null,
        status: "open",
      },
    );

    const result = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      occurredAt: "2026-02-01T02:00:40Z",
    });

    assert.equal(result.action, "clock_out");
    assert.equal(result.segmentId, "segment-new");
    assert.equal(result.metadata?.multipleOpenSegments, true);
  });

  it("debounces repeated scans under 10 seconds", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    const first = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      occurredAt: "2026-02-01T09:00:00Z",
    });
    assert.equal(first.action, "clock_in");

    const second = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      occurredAt: "2026-02-01T09:00:05Z",
    });
    assert.equal(second.action, "debounced");
  });


  it("rejects stale occurredAt when closing open segment", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    segments.push({
      id: "segment-open",
      employee_id: employeeId,
      house_id: houseId,
      work_date: "2026-02-01",
      time_in: "2026-02-01T08:00:00+08:00",
      time_out: null,
      status: "open",
    });

    await assert.rejects(
      () =>
        processKioskScan(repo, {
          kioskToken,
          qrToken,
          occurredAt: "2026-02-01T07:59:00+08:00",
        }),
      (error: unknown) => error instanceof KioskConflictError,
    );

    assert.equal(segments[0]?.time_out, null);
    assert.equal(segments[0]?.status, "open");
    const rejectEvent = events.find((item) => item.event_type === "reject");
    assert.equal(rejectEvent?.metadata.reason, "stale_occurred_at");
  });

  it("retries sync after sync_fail with same clientEventId", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    events.push({
      house_id: houseId,
      branch_id: branchId,
      device_id: "device-1",
      employee_id: employeeId,
      event_type: "sync_fail",
      occurred_at: "2026-02-01T09:00:00+08:00",
      metadata: { clientEventId: "event-retry" },
    });

    const sync = await processKioskSync(repo, {
      kioskToken,
      events: [{ qrToken, occurredAt: "2026-02-01T10:00:00+08:00", clientEventId: "event-retry" }],
    });

    assert.equal(sync.results[0]?.status, "processed");
  });

  it("sync is idempotent via clientEventId", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    const firstSync = await processKioskSync(repo, {
      kioskToken,
      events: [
        {
          qrToken,
          occurredAt: "2026-02-01T09:00:00Z",
          clientEventId: "event-1",
        },
      ],
    });

    assert.equal(firstSync.results[0]?.status, "processed");

    const secondSync = await processKioskSync(repo, {
      kioskToken,
      events: [
        {
          qrToken,
          occurredAt: "2026-02-01T09:00:00Z",
          clientEventId: "event-1",
        },
      ],
    });

    assert.equal(secondSync.results[0]?.status, "duplicate");
  });

  it("rejects disabled device token", async () => {
    devices[0] = { ...devices[0], is_active: false };
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    await assert.rejects(() => processKioskScan(repo, { kioskToken, qrToken }), (error: unknown) => error instanceof KioskAuthError);
  });



  it("emits employee lookup timing when lookup throws", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    let employeeLookupMs: number | null = null;
    repo.findEmployeeById = async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      throw new Error("lookup timeout");
    };

    await assert.rejects(
      () => processKioskScan(repo, {
        kioskToken,
        qrToken,
        occurredAt: "2026-02-01T09:00:00Z",
        timingHooks: {
          onEmployeeLookupComplete(durationMs) {
            employeeLookupMs = durationMs;
          },
        },
      }),
      /lookup timeout/,
    );

    assert.ok((employeeLookupMs ?? 0) >= 10);
  });

  it("reports scan timing hooks for debug instrumentation", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    const timings: Record<string, number> = {};

    const result = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      occurredAt: "2026-02-01T09:00:00Z",
      timingHooks: {
        onTokenResolved(durationMs) {
          timings.tokenResolveMs = durationMs;
        },
        onEmployeeLookupComplete(durationMs) {
          timings.employeeLookupMs = durationMs;
        },
        onActionDecisionComplete(durationMs) {
          timings.actionDecisionMs = durationMs;
        },
        onWriteComplete(durationMs) {
          timings.writeMs = durationMs;
        },
      },
    });

    assert.equal(result.action, "clock_in");
    assert.ok(typeof timings.tokenResolveMs === "number");
    assert.ok(typeof timings.employeeLookupMs === "number");
    assert.ok(typeof timings.actionDecisionMs === "number");
    assert.ok(typeof timings.writeMs === "number");
  });

  it("touches device on scan and sync", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    await processKioskScan(repo, { kioskToken, qrToken, occurredAt: "2026-02-01T09:00:00Z" });
    assert.ok(touchedDeviceIds.length >= 1);

    await processKioskSync(repo, {
      kioskToken,
      events: [{ qrToken, occurredAt: "2026-02-01T09:01:00Z", clientEventId: "touch-1" }],
    });
    assert.ok(touchedDeviceIds.length >= 2);
  });

  it("skips duplicate device lookup when authenticated device is supplied", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    const result = await processKioskScan(repo, {
      kioskToken,
      authenticatedDevice: {
        id: devices[0]!.id,
        houseId: devices[0]!.house_id,
        branchId: devices[0]!.branch_id,
      },
      qrToken,
      occurredAt: "2026-02-01T09:00:00Z",
    });

    assert.equal(result.action, "clock_in");
    assert.equal(findDeviceByTokenHashCalls, 0);
  });

});
