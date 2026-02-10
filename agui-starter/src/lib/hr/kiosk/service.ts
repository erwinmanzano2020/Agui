import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import { verifyEmployeeQrToken } from "@/lib/hr/kiosk/qr";
import {
  toManilaDate,
  toManilaOffsetTimestampFromDate,
  toManilaTimeHHmm,
} from "@/lib/hr/timezone";

const DEBOUNCE_SECONDS = 10;

type KioskDevice = { id: string; house_id: string; branch_id: string; is_active: boolean };
type KioskEmployee = {
  id: string;
  house_id: string;
  code: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};
type KioskSegment = {
  id: string;
  employee_id: string;
  house_id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string;
};
type KioskEvent = { occurred_at: string };

type KioskRepo = {
  findDeviceByTokenHash(tokenHash: string): Promise<KioskDevice | null>;
  touchDevice(deviceId: string, seenAt: string): Promise<void>;
  findEmployeeById(employeeId: string): Promise<KioskEmployee | null>;
  findOpenSegments(employeeId: string): Promise<KioskSegment[]>;
  closeSegment(segmentId: string, timeOut: string): Promise<KioskSegment | null>;
  createOpenSegment(input: {
    houseId: string;
    employeeId: string;
    workDate: string;
    timeIn: string;
  }): Promise<KioskSegment | null>;
  findLatestEmployeeEvent(houseId: string, employeeId: string): Promise<KioskEvent | null>;
  insertKioskEvent(input: {
    houseId: string;
    branchId: string;
    employeeId?: string | null;
    eventType: "scan" | "clock_in" | "clock_out" | "reject" | "queued" | "sync_success" | "sync_fail";
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  hasSyncClientEventId(houseId: string, branchId: string, clientEventId: string): Promise<boolean>;
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

function getDisplayName(employee: KioskEmployee): string {
  if (employee.first_name) {
    const initial = employee.last_name?.trim()?.charAt(0);
    if (initial) return `${employee.first_name.trim()} ${initial}.`;
    return employee.first_name.trim();
  }
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

function diffSeconds(a: string, b: string): number {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return Number.POSITIVE_INFINITY;
  return Math.abs(aMs - bMs) / 1000;
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
    qrToken: string;
    occurredAt?: string;
    clientId?: string;
    offlineAccepted?: boolean;
  },
): Promise<KioskScanResult> {
  const tokenHash = hashKioskToken(input.kioskToken);
  const device = await repo.findDeviceByTokenHash(tokenHash);
  if (!device || !device.is_active) {
    throw new KioskAuthError("Invalid kiosk token.");
  }

  const occurredAt = normalizeOccurredAt(input.occurredAt);
  await repo.touchDevice(device.id, occurredAt);

  let qrClaims: { employeeId: string; houseId: string };
  try {
    qrClaims = verifyEmployeeQrToken(input.qrToken);
  } catch (error) {
    await repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      eventType: "reject",
      occurredAt,
      metadata: {
        reason: "invalid_qr",
        clientId: input.clientId ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  if (qrClaims.houseId !== device.house_id) {
    await repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      employeeId: qrClaims.employeeId,
      eventType: "reject",
      occurredAt,
      metadata: { reason: "house_mismatch", clientId: input.clientId ?? null },
    });
    throw new Error("QR token does not match kiosk house.");
  }

  const employee = await repo.findEmployeeById(qrClaims.employeeId);
  if (!employee || employee.house_id !== device.house_id) {
    await repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      employeeId: qrClaims.employeeId,
      eventType: "reject",
      occurredAt,
      metadata: { reason: "employee_not_found", clientId: input.clientId ?? null },
    });
    throw new Error("Employee is not available for this kiosk.");
  }

  const lastEvent = await repo.findLatestEmployeeEvent(device.house_id, employee.id);
  if (lastEvent && diffSeconds(lastEvent.occurred_at, occurredAt) < DEBOUNCE_SECONDS) {
    return {
      action: "debounced",
      employee: { id: employee.id, code: employee.code, displayName: getDisplayName(employee) },
      segmentId: null,
      workDate: toManilaDate(occurredAt) ?? occurredAt.slice(0, 10),
      time: toManilaTimeHHmm(occurredAt) ?? "",
      offlineAccepted: Boolean(input.offlineAccepted),
    };
  }

  await repo.insertKioskEvent({
    houseId: device.house_id,
    branchId: device.branch_id,
    employeeId: employee.id,
    eventType: "scan",
    occurredAt,
    metadata: { clientId: input.clientId ?? null },
  });

  const openSegments = await repo.findOpenSegments(employee.id);
  const latestOpen = openSegments[0] ?? null;
  const workDate = toManilaDate(occurredAt) ?? occurredAt.slice(0, 10);
  const metadata: Record<string, unknown> = {};

  if (openSegments.length > 1) {
    metadata.multipleOpenSegments = true;
  }

  if (latestOpen) {
    const timeInMs = latestOpen.time_in ? new Date(latestOpen.time_in).getTime() : Number.NaN;
    const occurredAtMs = new Date(occurredAt).getTime();
    if (!Number.isNaN(timeInMs) && occurredAtMs <= timeInMs) {
      await repo.insertKioskEvent({
        houseId: device.house_id,
        branchId: device.branch_id,
        employeeId: employee.id,
        eventType: "reject",
        occurredAt,
        metadata: {
          reason: "stale_occurred_at",
          timeIn: latestOpen.time_in,
          occurredAt,
          clientEventId: input.clientId ?? null,
          segmentId: latestOpen.id,
        },
      });
      throw new KioskConflictError("occurredAt is earlier than or equal to open segment time_in.", {
        reason: "stale_occurred_at",
        employee: { id: employee.id, code: employee.code, displayName: getDisplayName(employee) },
        segmentId: latestOpen.id,
        timeIn: latestOpen.time_in,
        occurredAt,
      });
    }

    const closed = await repo.closeSegment(latestOpen.id, occurredAt);
    if (!closed) throw new Error("Failed to close open segment.");
    await repo.insertKioskEvent({
      houseId: device.house_id,
      branchId: device.branch_id,
      employeeId: employee.id,
      eventType: "clock_out",
      occurredAt,
      metadata: { segmentId: closed.id, clientId: input.clientId ?? null, ...metadata },
    });
    return {
      action: "clock_out",
      employee: { id: employee.id, code: employee.code, displayName: getDisplayName(employee) },
      segmentId: closed.id,
      workDate,
      time: toManilaTimeHHmm(occurredAt) ?? "",
      offlineAccepted: Boolean(input.offlineAccepted),
      metadata,
    };
  }

  const created = await repo.createOpenSegment({
    houseId: device.house_id,
    employeeId: employee.id,
    workDate,
    timeIn: occurredAt,
  });
  if (!created) throw new Error("Failed to create open segment.");

  await repo.insertKioskEvent({
    houseId: device.house_id,
    branchId: device.branch_id,
    employeeId: employee.id,
    eventType: "clock_in",
    occurredAt,
    metadata: { segmentId: created.id, clientId: input.clientId ?? null, ...metadata },
  });

  return {
    action: "clock_in",
    employee: { id: employee.id, code: employee.code, displayName: getDisplayName(employee) },
    segmentId: created.id,
    workDate,
    time: toManilaTimeHHmm(occurredAt) ?? "",
    offlineAccepted: Boolean(input.offlineAccepted),
    metadata,
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

  const results: Array<
    | { clientEventId: string; status: "duplicate" }
    | { clientEventId: string; status: "processed"; result: KioskScanResult }
    | { clientEventId: string; status: "error"; error: string }
  > = [];

  for (const event of input.events) {
    const isDuplicate = await repo.hasSyncClientEventId(device.house_id, device.branch_id, event.clientEventId);
    if (isDuplicate) {
      results.push({ clientEventId: event.clientEventId, status: "duplicate" });
      continue;
    }

    try {
      const result = await processKioskScan(repo, {
        kioskToken: input.kioskToken,
        qrToken: event.qrToken,
        occurredAt: event.occurredAt,
        clientId: event.clientEventId,
        offlineAccepted: true,
      });
      await repo.insertKioskEvent({
        houseId: device.house_id,
        branchId: device.branch_id,
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

export type { KioskRepo, KioskDevice, KioskEmployee, KioskSegment };
