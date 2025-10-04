export function toDateTime(dateISO: string, timeHHMM: string) {
  const [h, m, s] = timeHHMM?.split(":") ?? [];
  const d = new Date(dateISO + "T00:00:00");
  d.setHours(
    parseInt(h || "0", 10),
    parseInt(m || "0", 10),
    parseInt(s || "0", 10) || 0,
    0,
  );
  return d;
}
export function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
}
