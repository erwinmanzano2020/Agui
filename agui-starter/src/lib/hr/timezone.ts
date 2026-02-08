const MANILA_TIMEZONE = "Asia/Manila";
const MANILA_OFFSET = "+08:00";

type DateParts = { year: number; month: number; day: number };
type TimeParts = { hour: number; minute: number; second: number };

function parseDateParts(date: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function parseTimeParts(time: string): TimeParts | null {
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

function formatManilaOffsetTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${MANILA_OFFSET}`;
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

function buildZonedDateTime(date: string, time: string, timeZone: string): Date | null {
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

export function toManilaTimestamp(workDate: string, time: string): string | null {
  const zoned = buildZonedDateTime(workDate, time, MANILA_TIMEZONE);
  return zoned ? formatManilaOffsetTimestamp(zoned) : null;
}

export function toManilaOffsetTimestampFromDate(date: Date): string {
  return formatManilaOffsetTimestamp(date);
}

export function getManilaTimeString(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatManilaTimeFromIso(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return getManilaTimeString(date).slice(0, 5);
}

export function normalizeManilaTimestamp(
  value: string | null | undefined,
  fallbackDate?: string,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[Zz]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const dateTimeMatch = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(
    trimmed,
  );
  if (dateTimeMatch) {
    return toManilaTimestamp(dateTimeMatch[1], dateTimeMatch[2]);
  }
  if (fallbackDate) {
    return toManilaTimestamp(fallbackDate, trimmed);
  }
  return null;
}
