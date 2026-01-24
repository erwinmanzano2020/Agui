export type OvertimePolicyInput = {
  timezone: string;
  ot_mode: string;
  min_ot_minutes: number;
  rounding_minutes: number;
  rounding_mode: string;
};

export type ScheduleWindowInput = {
  start_time: string;
  end_time: string;
  timezone: string;
};

export type OvertimeSegmentInput = {
  time_in: string | null;
  time_out: string | null;
};

export type OvertimeComputationResult = {
  worked_minutes_total: number;
  worked_minutes_within_schedule: number;
  overtime_minutes: number;
  open_segments_count: number;
  warnings: string[];
};

type DateParts = { year: number; month: number; day: number };
type TimeParts = { hour: number; minute: number; second: number };

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function parseDateParts(date: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

export function parseTimeParts(time: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
  return { hour, minute, second };
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getTimeZoneOffsetMs(timeZone: string, utcDate: Date): number {
  const parts = getFormatter(timeZone).formatToParts(utcDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const second = Number(values.second);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return localAsUtc - utcDate.getTime();
}

export function buildZonedDateTime(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const dateParts = parseDateParts(date);
  const timeParts = parseTimeParts(time);
  if (!dateParts || !timeParts) return null;
  const { year, month, day } = dateParts;
  const { hour, minute, second } = timeParts;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMs(timeZone, utcGuess);
  let adjusted = new Date(utcGuess.getTime() - offset);
  const nextOffset = getTimeZoneOffsetMs(timeZone, adjusted);
  if (nextOffset !== offset) {
    adjusted = new Date(utcGuess.getTime() - nextOffset);
  }
  return adjusted;
}

export function getDayOfWeekInTimeZone(date: string, timeZone: string): number | null {
  const midday = buildZonedDateTime(date, "12:00", timeZone);
  if (!midday) return null;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(midday);
  return WEEKDAY_MAP[weekday] ?? null;
}

function diffMinutes(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  if (endMs <= startMs) return 0;
  return Math.floor((endMs - startMs) / 60000);
}

function applyRounding(minutes: number, roundingMinutes: number, mode: string): number {
  if (roundingMinutes <= 1 || mode === "NONE") return minutes;
  const ratio = minutes / roundingMinutes;
  if (mode === "FLOOR") return Math.floor(ratio) * roundingMinutes;
  if (mode === "CEIL") return Math.ceil(ratio) * roundingMinutes;
  if (mode === "NEAREST") return Math.round(ratio) * roundingMinutes;
  return minutes;
}

export function computeOvertimeForDay(input: {
  segments: OvertimeSegmentInput[];
  workDate: string;
  scheduleWindow: ScheduleWindowInput | null;
  policy: OvertimePolicyInput;
}): OvertimeComputationResult {
  const warnings: string[] = [];
  let workedMinutesTotal = 0;
  let workedMinutesWithinSchedule = 0;
  let overtimeMinutes = 0;
  let openSegmentsCount = 0;

  const scheduleStart =
    input.scheduleWindow
      ? buildZonedDateTime(input.workDate, input.scheduleWindow.start_time, input.scheduleWindow.timezone)
      : null;
  const scheduleEnd =
    input.scheduleWindow
      ? buildZonedDateTime(input.workDate, input.scheduleWindow.end_time, input.scheduleWindow.timezone)
      : null;

  if (!input.scheduleWindow || !scheduleStart || !scheduleEnd) {
    warnings.push("missing schedule window");
  }

  input.segments.forEach((segment, index) => {
    if (!segment.time_in || !segment.time_out) {
      if (!segment.time_out) openSegmentsCount += 1;
      warnings.push(`segment ${index + 1} missing time_in/time_out`);
      return;
    }
    const startMs = Date.parse(segment.time_in);
    const endMs = Date.parse(segment.time_out);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      warnings.push(`segment ${index + 1} has invalid timestamps`);
      return;
    }
    if (endMs <= startMs) {
      warnings.push(`segment ${index + 1} has non-positive duration`);
      return;
    }
    workedMinutesTotal += diffMinutes(startMs, endMs);

    if (scheduleStart && scheduleEnd) {
      const withinStart = Math.max(startMs, scheduleStart.getTime());
      const withinEnd = Math.min(endMs, scheduleEnd.getTime());
      workedMinutesWithinSchedule += diffMinutes(withinStart, withinEnd);

      if (input.policy.ot_mode === "AFTER_SCHEDULE_END") {
        const overtimeStart = Math.max(startMs, scheduleEnd.getTime());
        overtimeMinutes += diffMinutes(overtimeStart, endMs);
      }
    }
  });

  if (input.policy.ot_mode !== "AFTER_SCHEDULE_END") {
    warnings.push(`unsupported ot_mode ${input.policy.ot_mode}`);
  }

  if (overtimeMinutes < input.policy.min_ot_minutes) {
    overtimeMinutes = 0;
  }
  overtimeMinutes = applyRounding(
    overtimeMinutes,
    input.policy.rounding_minutes,
    input.policy.rounding_mode,
  );

  return {
    worked_minutes_total: workedMinutesTotal,
    worked_minutes_within_schedule: scheduleStart && scheduleEnd ? workedMinutesWithinSchedule : 0,
    overtime_minutes: overtimeMinutes,
    open_segments_count: openSegmentsCount,
    warnings,
  };
}
