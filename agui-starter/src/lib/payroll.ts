// agui-starter/src/lib/payroll.ts
import { toDateTime, minutesBetween } from "./time";
import type { EffectiveShift } from "./shifts";

/**
 * Regular vs OT minutes
 *
 * Rules:
 * - Rest day (no shift): all minutes are OT.
 * - If OUT < (END + GRACE): everything is regular (no OT).
 * - If OUT >= (END + GRACE): OT counts from END (not from cutoff).
 */
export function computeMinutes(
  workDateISO: string,
  timeIn: Date | null,
  timeOut: Date | null,
  shift: EffectiveShift,
): { regular: number; ot: number; total: number } {
  if (!timeIn || !timeOut) return { regular: 0, ot: 0, total: 0 };

  // Rest day ⇒ all minutes go to OT
  if (!shift.end_time || shift.ot_grace_min == null) {
    const total = minutesBetween(timeIn, timeOut);
    return { regular: 0, ot: total, total };
  }

  const shiftEnd = toDateTime(workDateISO, shift.end_time);
  const graceCutoff = new Date(shiftEnd.getTime() + shift.ot_grace_min * 60000);

  const total = minutesBetween(timeIn, timeOut);

  // Case 1: still within grace window → no OT
  if (timeOut < graceCutoff) {
    return { regular: total, ot: 0, total };
  }

  // Case 2: beyond grace → OT starts from END
  const regular = Math.max(0, minutesBetween(timeIn, shiftEnd));
  const ot = Math.max(0, total - regular);

  return { regular, ot, total };
}

// --- Lateness & Undertime helpers ------------------------------------------

/** minutes late if timeIn is after shift start */
export function computeLateMinutes(
  workDateISO: string,
  timeIn: Date | null,
  shift: EffectiveShift,
): number {
  if (!timeIn || !shift.start_time) return 0;
  const start = toDateTime(workDateISO, shift.start_time);
  if (timeIn <= start) return 0;
  return Math.floor((timeIn.getTime() - start.getTime()) / 60000);
}

/**
 * minutes undertime if timeOut is before shift end (ignoring grace; grace affects OT only)
 * Note: OT grace still applies to OT (already handled in computeMinutes). Lateness/undertime are separate.
 */
export function computeUndertimeMinutes(
  workDateISO: string,
  timeOut: Date | null,
  shift: EffectiveShift,
): number {
  if (!timeOut || !shift.end_time) return 0;
  const end = toDateTime(workDateISO, shift.end_time);
  if (timeOut >= end) return 0;
  return Math.floor((end.getTime() - timeOut.getTime()) / 60000);
}
