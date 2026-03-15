export type Segment = { time_in: string; time_out: string | null };

/** Sum minutes across finished segments only (ignore open ones). */
export function sumFinishedMinutes(segments: Segment[]) {
  let mins = 0;
  for (const s of segments) {
    if (!s.time_out) continue;
    const a = new Date(s.time_in).getTime();
    const b = new Date(s.time_out).getTime();
    if (b > a) mins += Math.floor((b - a) / 60000);
  }
  return mins;
}

/** Get last OUT time from segments (latest end_at) */
export function latestOut(segments: Segment[]): Date | null {
  let latest: number | null = null;
  for (const s of segments) {
    if (!s.time_out) continue;
    const t = new Date(s.time_out).getTime();
    if (latest === null || t > latest) latest = t;
  }
  return latest ? new Date(latest) : null;
}

// --- Timezone-safe helpers --------------------------------------------------

/** Convert a date string to local HH:MM (24h), safe for timestamptz */
export function toLocalHHMM(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  // Force 24h format, zero-padded, in user's local time
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Weekday short name for YYYY-MM-DD */
export function weekdayShort(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" }); // Sun, Mon, ...
}
