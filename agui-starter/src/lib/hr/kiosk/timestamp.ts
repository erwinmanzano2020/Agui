export function normalizeKioskTimestamp(value: string): string {
  const trimmed = value.trim();

  const postgresTimestampMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})(?::?(\d{2}))?$/,
  );

  if (!postgresTimestampMatch) {
    return trimmed;
  }

  const [, datePart, timePart, offsetHour, offsetMinuteRaw] = postgresTimestampMatch;
  const offsetMinute = offsetMinuteRaw ?? "00";
  const isUtc = (offsetHour === "+00" || offsetHour === "-00") && offsetMinute === "00";

  if (isUtc) {
    return `${datePart}T${timePart}Z`;
  }

  return `${datePart}T${timePart}${offsetHour}:${offsetMinute}`;
}

export function parseKioskTimestamp(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = normalizeKioskTimestamp(value);
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
