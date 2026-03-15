import type { DtrSegmentRow } from "@/lib/db.types";

export type ScheduleTimeBounds = {
  scheduledStartTs: string;
  scheduledEndTs: string;
  breakStartTs?: string | null;
  breakEndTs?: string | null;
};

export type DailyRateBreakdown = {
  scheduledMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  flags: string[];
};

function diffMinutes(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  if (endMs <= startMs) return 0;
  return Math.floor((endMs - startMs) / 60000);
}

function resolveBreakBounds(
  scheduleStartMs: number,
  scheduleEndMs: number,
  breakStartTs?: string | null,
  breakEndTs?: string | null,
): { breakStartMs: number | null; breakEndMs: number | null; flags: string[] } {
  const flags: string[] = [];
  if (!breakStartTs || !breakEndTs) {
    return { breakStartMs: null, breakEndMs: null, flags };
  }

  const breakStartMs = Date.parse(breakStartTs);
  const breakEndMs = Date.parse(breakEndTs);
  if (!Number.isFinite(breakStartMs) || !Number.isFinite(breakEndMs)) {
    flags.push("invalid_break");
    return { breakStartMs: null, breakEndMs: null, flags };
  }

  if (
    breakStartMs >= breakEndMs ||
    breakStartMs < scheduleStartMs ||
    breakEndMs > scheduleEndMs
  ) {
    flags.push("invalid_break");
    return { breakStartMs: null, breakEndMs: null, flags };
  }

  return { breakStartMs, breakEndMs, flags };
}

export function computeDailyRateBreakdown(
  segments: Pick<DtrSegmentRow, "time_in" | "time_out">[],
  schedule: ScheduleTimeBounds | null,
): DailyRateBreakdown {
  if (!schedule) {
    return {
      scheduledMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      flags: ["missing_schedule"],
    };
  }

  const scheduleStartMs = Date.parse(schedule.scheduledStartTs);
  const scheduleEndMs = Date.parse(schedule.scheduledEndTs);
  if (!Number.isFinite(scheduleStartMs) || !Number.isFinite(scheduleEndMs) || scheduleEndMs <= scheduleStartMs) {
    return {
      scheduledMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      flags: ["invalid_schedule"],
    };
  }

  const { breakStartMs, breakEndMs, flags } = resolveBreakBounds(
    scheduleStartMs,
    scheduleEndMs,
    schedule.breakStartTs,
    schedule.breakEndTs,
  );
  const breakMinutes =
    breakStartMs !== null && breakEndMs !== null
      ? diffMinutes(breakStartMs, breakEndMs)
      : 0;

  const scheduledMinutes = Math.max(
    0,
    diffMinutes(scheduleStartMs, scheduleEndMs) - breakMinutes,
  );

  let regularMinutes = 0;
  let overtimeMinutes = 0;

  segments.forEach((segment) => {
    if (!segment.time_in || !segment.time_out) return;
    const startMs = Date.parse(segment.time_in);
    const endMs = Date.parse(segment.time_out);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;

    const withinStart = Math.max(startMs, scheduleStartMs);
    const withinEnd = Math.min(endMs, scheduleEndMs);
    let segmentRegularMinutes = diffMinutes(withinStart, withinEnd);
    if (segmentRegularMinutes > 0 && breakStartMs !== null && breakEndMs !== null) {
      const breakOverlapStart = Math.max(withinStart, breakStartMs);
      const breakOverlapEnd = Math.min(withinEnd, breakEndMs);
      segmentRegularMinutes -= diffMinutes(breakOverlapStart, breakOverlapEnd);
    }
    if (segmentRegularMinutes > 0) {
      regularMinutes += segmentRegularMinutes;
    }

    const overtimeStart = Math.max(startMs, scheduleEndMs);
    overtimeMinutes += diffMinutes(overtimeStart, endMs);
  });

  return {
    scheduledMinutes,
    regularMinutes,
    overtimeMinutes,
    flags,
  };
}
