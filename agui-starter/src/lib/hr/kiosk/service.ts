import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import { verifyEmployeeQrToken } from "@/lib/hr/kiosk/qr";
import {
  toManilaDate,
  toManilaOffsetTimestampFromDate,
  toManilaTimeHHmm,
} from "@/lib/hr/timezone";

type KioskDevice = { id: string; house_id: string; branch_id: string; is_active: boolean };
type KioskEmployee = {
  id: string;
  house_id: string;
  code: string | null;
  full_name: string | null;
};

// Retained as a public compatibility type for existing tests/imports. Runtime kiosk
// mutation no longer reads or writes raw segments through the repository.
type KioskSegment = {
  id: string;
  employee_id: string;
  house_id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string;
};

type KioskCommandResult = {
  action: "clock_in" | "clock_out" | "debounced";
  segmentId: string | null;
  factId?: string | null;
  valueRevision?: number | null;
  evidenceBasisRevision?: number | null;
  employeeGeneration?: number | null;
  workDate: string;
  multipleOpenSegments?: boolean;
  replayed?: boolean;
};

type KioskRepo = {
  findDeviceByTokenHash(tokenHash: string): Promise<KioskDevice | null>;
  touchDevice(deviceId: string): Promise<void>;
  findEmployeeById(employeeId: string): Promise<KioskEmployee | null>;
  applyAttendanceScan(input: {
    houseId: string;
    branchId: string;
    deviceId: string;
    employeeId: string;
    operationId: string;
    occurredAt: string;
  }): Promise<KioskCommandResult>;
  insertKioskEvent(input: {
    deviceId: string;
    houseId: string;
    branchId: string;
    employeeId?: string | null;
    eventType: "scan" | "clock_in" | "clock_out" | "reject" | "queued" | "sync_success" | "sync_fail";
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
};

export type KioskScanResult = {
  action: "clock_in" | "clock_out" | "debounced";
  employee: { id: string; code: string | null; displayName: string };
  segmentId: string | null;
  workDate: string;
  time: string;
  offlineAccepted: boolean;
  metadata?: Record<string, unknown>;
};

export type KioskScanTimingHooks = {
  onTokenResolved?: (durationMs: number) => void;
  onEmployeeLookupComplete?: (durationMs: number) => void;
  onActionDecisionComplete?: (durationMs: number) => void;
  onWriteComplete?: (durationMs: number) => void;
};

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getDisplayName(employee: KioskEmployee): string {
  return employee.full_name?.trim() || employee.code?.trim() || employee.id;
}

function normalizeOccurredAt(occurredAt?: string): string {
  if (!occurredAt) return toManilaOffsetTimestampFromDate(new Date());
  const parsed = new Date(occurredAt);
  if (!Number.isNaN(parsed.getTime())) {
    return toManilaOffsetTimestampFromDate(parsed);
  }
  throw new Error("Invalid occurredAt timestamp.");
}

export class KioskAuthError extends Error {}

export class KioskConflictError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "KioskConflictError";
    this.details = details;
  }
}

export async function processKioskScan(
  repo: KioskRepo,
  input: {
    kioskToken: string;
    authenticatedDevice?: { id: string; houseId: string; branchId: string };
    qrToken: string;
    occurredAt?: string;
    clientId?: string;
    offlineAccepted?: boolean;
    timingHooks?: KioskScanTimingHooks;
  },
): Promise<KioskScanResult> {
  let writeMs = 0;
  const trackWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
    const startedAt = nowMs();
    try {
      return await operation();
    } finally {
      writeMs += nowMs() - startedAt;
      input.timingHooks?.onWriteComplete?.(Math.round(writeMs));
    }
  };

  const device = input.authenticatedDevice
    ? {
      id: input.authenticatedDevice.id,
      house_id: input.authenticatedDevice.houseId,
      branch_id: input.authenticatedDevice.branchId,
      is_active: true,
    }
    : await (async () => {
      const tokenHash = hashKioskToken(input.kioskToken);
      const foundDevice = await repo.findDeviceByTokenHash(tokenHash);
      if (!foundDevice || !foundDevice.is_active) {
        throw new KioskAuthError("Invalid kiosk token.");
      }
      return foundDevice;
    })();

  const occurredAt = normalizeOccurredAt(input.occurredAt);
  await trackWrite(() => repo.touchDevice(device.id));

  let qrClaims: { employeeId: string; houseId: string };
  const tokenResolveStartedAt = nowMs();
  try {
    qrClaims = verifyEmployeeQrToken(input.qrToken);
  } catch (error) {
    input.timingHooks?.onTokenResolved?.(Math.round(nowMs() - tokenResolveStartedAt));
    await trackWrite(() => repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      deviceId: device.id,
      eventType: "reject",
      occurredAt,
      metadata: {
        deviceId: device.id,
        reason: "invalid_qr",
        clientId: input.clientId ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    }));
    throw error;
  }
  input.timingHooks?.onTokenResolved?.(Math.round(nowMs() - tokenResolveStartedAt));

  if (qrClaims.houseId !== device.house_id) {
    await trackWrite(() => repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      deviceId: device.id,
      employeeId: qrClaims.employeeId,
      eventType: "reject",
      occurredAt,
      metadata: { reason: "house_mismatch", clientId: input.clientId ?? null },
    }));
    throw new Error("QR token does not match kiosk house.");
  }

  const employeeLookupStartedAt = nowMs();
  let employee: KioskEmployee | null = null;
  try {
    employee = await repo.findEmployeeById(qrClaims.employeeId);
  } finally {
    input.timingHooks?.onEmployeeLookupComplete?.(
      Math.round(nowMs() - employeeLookupStartedAt),
    );
  }
  if (!employee || employee.house_id !== device.house_id) {
    await trackWrite(() => repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      deviceId: device.id,
      employeeId: qrClaims.employeeId,
      eventType: "reject",
      occurredAt,
      metadata: { reason: "employee_not_found", clientId: input.clientId ?? null },
    }));
    throw new Error("Employee is not available for this kiosk.");
  }

  const operationId = input.clientId?.trim() ?? "";
  if (!operationId) {
    await trackWrite(() => repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      deviceId: device.id,
      employeeId: employee.id,
      eventType: "reject",
      occurredAt,
      metadata: { reason: "missing_client_id" },
    }));
    throw new KioskConflictError("Kiosk scan is missing stable operation identity.", {
      reason: "missing_client_id",
      employee: { id: employee.id, code: employee.code, displayName: getDisplayName(employee) },
    });
  }

  const commandStartedAt = nowMs();
  let command: KioskCommandResult;
  try {
    command = await trackWrite(() => repo.applyAttendanceScan({
      houseId: device.house_id,
      branchId: device.branch_id,
      deviceId: device.id,
      employeeId: employee.id,
      operationId,
      occurredAt,
    }));
  } catch (error) {
    input.timingHooks?.onActionDecisionComplete?.(
      Math.round(nowMs() - commandStartedAt),
    );
    if (
      error instanceof Error &&
      /earlier than or equal to open attendance time_in|occurrence time/i.test(error.message)
    ) {
      await trackWrite(() => repo.insertKioskEvent({
        houseId: device.house_id,
        branchId: device.branch_id,
        deviceId: device.id,
        employeeId: employee.id,
        eventType: "reject",
        occurredAt,
        metadata: {
          reason: "stale_occurred_at",
          occurredAt,
          clientEventId: operationId,
        },
      }));
      throw new KioskConflictError(error.message, {
        reason: "stale_occurred_at",
        employee: { id: employee.id, code: employee.code, displayName: getDisplayName(employee) },
        occurredAt,
      });
    }
    throw error;
  }
  input.timingHooks?.onActionDecisionComplete?.(
    Math.round(nowMs() - commandStartedAt),
  );

  const metadata: Record<string, unknown> = {};
  if (command.multipleOpenSegments) metadata.multipleOpenSegments = true;
  if (command.replayed) metadata.replayed = true;

  return {
    action: command.action,
    employee: { id: employee.id, code: employee.code, displayName: getDisplayName(employee) },
    segmentId: command.segmentId,
    workDate: command.workDate || toManilaDate(occurredAt) || occurredAt.slice(0, 10),
    time: toManilaTimeHHmm(occurredAt) ?? "",
    offlineAccepted: Boolean(input.offlineAccepted),
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export async function processKioskSync(
  repo: KioskRepo,
  input: {
    kioskToken: string;
    events: Array<{ qrToken: string; occurredAt?: string; clientEventId: string }>;
  },
): Promise<{
  results: Array<
    | { clientEventId: string; status: "duplicate" }
    | { clientEventId: string; status: "processed"; result: KioskScanResult }
    | { clientEventId: string; status: "error"; error: string }
  >;
}> {
  const tokenHash = hashKioskToken(input.kioskToken);
  const device = await repo.findDeviceByTokenHash(tokenHash);
  if (!device || !device.is_active) {
    throw new KioskAuthError("Invalid kiosk token.");
  }

  await repo.touchDevice(device.id);

  const results: Array<
    | { clientEventId: string; status: "duplicate" }
    | { clientEventId: string; status: "processed"; result: KioskScanResult }
    | { clientEventId: string; status: "error"; error: string }
  > = [];

  for (const event of input.events) {
    try {
      const result = await processKioskScan(repo, {
        kioskToken: input.kioskToken,
        authenticatedDevice: {
          id: device.id,
          houseId: device.house_id,
          branchId: device.branch_id,
        },
        qrToken: event.qrToken,
        occurredAt: event.occurredAt,
        clientId: event.clientEventId,
        offlineAccepted: true,
      });

      if (result.metadata?.replayed === true) {
        results.push({ clientEventId: event.clientEventId, status: "duplicate" });
        continue;
      }

      await repo.insertKioskEvent({
        houseId: device.house_id,
        branchId: device.branch_id,
        deviceId: device.id,
        employeeId: result.employee.id,
        eventType: "sync_success",
        occurredAt: normalizeOccurredAt(event.occurredAt),
        metadata: { clientEventId: event.clientEventId, action: result.action },
      });
      results.push({ clientEventId: event.clientEventId, status: "processed", result });
    } catch (error) {
      await repo.insertKioskEvent({
        houseId: device.house_id,
        branchId: device.branch_id,
        deviceId: device.id,
        eventType: "sync_fail",
        occurredAt: normalizeOccurredAt(event.occurredAt),
        metadata: {
          clientEventId: event.clientEventId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      results.push({
        clientEventId: event.clientEventId,
        status: "error",
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }

  return { results };
}

export type {
  KioskRepo,
  KioskDevice,
  KioskEmployee,
  KioskSegment,
  KioskCommandResult,
};
