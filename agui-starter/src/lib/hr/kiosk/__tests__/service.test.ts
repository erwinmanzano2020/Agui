import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import { createEmployeeQrToken } from "@/lib/hr/kiosk/qr";
import {
  type KioskCommandResult,
  type KioskDevice,
  type KioskEmployee,
  type KioskRepo,
  KioskAuthError,
  KioskConflictError,
  processKioskScan,
  processKioskSync,
} from "@/lib/hr/kiosk/service";

describe("kiosk service canonical command adapter", () => {
  const houseId = "house-1";
  const branchId = "branch-1";
  const employeeId = "employee-1";
  const kioskToken = "valid-kiosk-token";

  let repo: KioskRepo;
  let device: KioskDevice;
  let employee: KioskEmployee;
  let events: Array<{
    house_id: string;
    branch_id: string;
    device_id: string;
    employee_id: string | null;
    event_type: string;
    occurred_at: string;
    metadata: Record<string, unknown>;
  }>;
  let touchedDeviceIds: string[];
  let findDeviceByTokenHashCalls: number;
  let commandCalls: Array<{
    houseId: string;
    branchId: string;
    deviceId: string;
    employeeId: string;
    operationId: string;
    occurredAt: string;
  }>;
  let nextCommand:
    | KioskCommandResult
    | ((input: (typeof commandCalls)[number]) => KioskCommandResult | Promise<KioskCommandResult>);

  beforeEach(() => {
    process.env.HR_KIOSK_QR_SECRET = "test-qr-secret";
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";

    device = {
      id: "device-1",
      house_id: houseId,
      branch_id: branchId,
      is_active: true,
    };
    employee = {
      id: employeeId,
      house_id: houseId,
      code: "EMP-001",
      full_name: "Edward Mercado",
    };
    events = [];
    touchedDeviceIds = [];
    findDeviceByTokenHashCalls = 0;
    commandCalls = [];
    nextCommand = {
      action: "clock_in",
      segmentId: "segment-1",
      factId: "fact-1",
      valueRevision: 1,
      evidenceBasisRevision: 1,
      employeeGeneration: 1,
      workDate: "2026-02-01",
      replayed: false,
    };

    repo = {
      async findDeviceByTokenHash(tokenHash) {
        findDeviceByTokenHashCalls += 1;
        return tokenHash === hashKioskToken(kioskToken) ? device : null;
      },
      async touchDevice(deviceId) {
        touchedDeviceIds.push(deviceId);
      },
      async findEmployeeById(id) {
        return id === employee.id ? employee : null;
      },
      async applyAttendanceScan(input) {
        commandCalls.push(input);
        return typeof nextCommand === "function"
          ? await nextCommand(input)
          : nextCommand;
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
    };
  });

  it("rejects invalid kiosk token before the command boundary", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    await assert.rejects(
      () =>
        processKioskScan(repo, {
          kioskToken: "bad",
          qrToken,
          clientId: "scan-1",
        }),
      (error: unknown) => error instanceof KioskAuthError,
    );
    assert.equal(commandCalls.length, 0);
  });

  it("rejects QR house mismatch and records a reject audit event", async () => {
    const qrToken = createEmployeeQrToken({
      employeeId,
      houseId: "another-house",
    });

    await assert.rejects(
      () =>
        processKioskScan(repo, {
          kioskToken,
          qrToken,
          clientId: "scan-house-mismatch",
        }),
      /QR token does not match kiosk house/,
    );

    assert.equal(commandCalls.length, 0);
    assert.equal(events.at(-1)?.event_type, "reject");
    assert.equal(events.at(-1)?.metadata.reason, "house_mismatch");
  });

  it("fails closed when a scan has no stable operation identity", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    await assert.rejects(
      () =>
        processKioskScan(repo, {
          kioskToken,
          qrToken,
          occurredAt: "2026-02-01T09:00:00Z",
        }),
      (error: unknown) =>
        error instanceof KioskConflictError &&
        error.details.reason === "missing_client_id",
    );

    assert.equal(commandCalls.length, 0);
    assert.equal(events.at(-1)?.metadata.reason, "missing_client_id");
  });

  it("passes verified device, employee, operation identity, and occurrence time to the DB command", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    const result = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      clientId: "scan-1",
      occurredAt: "2026-02-01T09:00:00+08:00",
    });

    assert.equal(result.action, "clock_in");
    assert.equal(result.segmentId, "segment-1");
    assert.deepEqual(commandCalls, [
      {
        houseId,
        branchId,
        deviceId: "device-1",
        employeeId,
        operationId: "scan-1",
        occurredAt: "2026-02-01T09:00:00+08:00",
      },
    ]);
  });

  it("returns DB-authoritative debounce without attempting a raw segment mutation", async () => {
    nextCommand = {
      action: "debounced",
      segmentId: null,
      workDate: "2026-02-01",
      replayed: false,
    };
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    const result = await processKioskScan(repo, {
      kioskToken,
      qrToken,
      clientId: "scan-debounced",
      occurredAt: "2026-02-01T09:00:05+08:00",
    });

    assert.equal(result.action, "debounced");
    assert.equal(result.segmentId, null);
  });

  it("maps stale DB command rejection to a kiosk conflict and audit event", async () => {
    nextCommand = async () => {
      throw new Error(
        "Kiosk occurrence time is earlier than or equal to open attendance time_in",
      );
    };
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    await assert.rejects(
      () =>
        processKioskScan(repo, {
          kioskToken,
          qrToken,
          clientId: "scan-stale",
          occurredAt: "2026-02-01T07:59:00+08:00",
        }),
      (error: unknown) =>
        error instanceof KioskConflictError &&
        error.details.reason === "stale_occurred_at",
    );

    assert.equal(events.at(-1)?.event_type, "reject");
    assert.equal(events.at(-1)?.metadata.reason, "stale_occurred_at");
  });

  it("uses the same clientEventId as the offline canonical operation identity", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    const sync = await processKioskSync(repo, {
      kioskToken,
      events: [
        {
          qrToken,
          occurredAt: "2026-02-01T10:00:00+08:00",
          clientEventId: "offline-1",
        },
      ],
    });

    assert.equal(sync.results[0]?.status, "processed");
    assert.equal(commandCalls[0]?.operationId, "offline-1");
    assert.equal(events.at(-1)?.event_type, "sync_success");
  });

  it("classifies DB idempotent replay as duplicate without adding sync_success", async () => {
    nextCommand = {
      action: "clock_in",
      segmentId: "segment-1",
      workDate: "2026-02-01",
      replayed: true,
    };
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    const sync = await processKioskSync(repo, {
      kioskToken,
      events: [
        {
          qrToken,
          occurredAt: "2026-02-01T10:00:00+08:00",
          clientEventId: "offline-replay",
        },
      ],
    });

    assert.equal(sync.results[0]?.status, "duplicate");
    assert.equal(
      events.filter((event) => event.event_type === "sync_success").length,
      0,
    );
  });

  it("surfaces a DB-side device invalidation as a per-event sync error", async () => {
    let commandCount = 0;
    nextCommand = async () => {
      commandCount += 1;
      if (commandCount === 2) {
        throw new Error("Kiosk device context is inactive or mismatched");
      }
      return {
        action: "clock_in",
        segmentId: "segment-1",
        workDate: "2026-02-01",
        replayed: false,
      };
    };
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    const sync = await processKioskSync(repo, {
      kioskToken,
      events: [
        {
          qrToken,
          occurredAt: "2026-02-01T09:00:00+08:00",
          clientEventId: "event-1",
        },
        {
          qrToken,
          occurredAt: "2026-02-01T09:01:00+08:00",
          clientEventId: "event-2",
        },
      ],
    });

    assert.equal(sync.results[0]?.status, "processed");
    assert.equal(sync.results[1]?.status, "error");
    assert.match(
      sync.results[1]?.status === "error" ? sync.results[1].error : "",
      /inactive or mismatched/,
    );
  });

  it("skips duplicate device-token lookup when sync passes a preauthenticated device", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });

    await processKioskSync(repo, {
      kioskToken,
      events: [
        {
          qrToken,
          occurredAt: "2026-02-01T09:00:00+08:00",
          clientEventId: "event-1",
        },
      ],
    });

    assert.equal(findDeviceByTokenHashCalls, 1);
  });

  it("reports timing hooks around validation and canonical command execution", async () => {
    const qrToken = createEmployeeQrToken({ employeeId, houseId });
    const timings: Record<string, number> = {};

    await processKioskScan(repo, {
      kioskToken,
      qrToken,
      clientId: "scan-timing",
      occurredAt: "2026-02-01T09:00:00+08:00",
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

    assert.ok(typeof timings.tokenResolveMs === "number");
    assert.ok(typeof timings.employeeLookupMs === "number");
    assert.ok(typeof timings.actionDecisionMs === "number");
    assert.ok(typeof timings.writeMs === "number");
    assert.ok(touchedDeviceIds.includes("device-1"));
  });
});
