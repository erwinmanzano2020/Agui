export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesBetween(inHHMM: string, outHHMM: string) {
  let start = toMinutes(inHHMM);
  let end = toMinutes(outHHMM);
  if (end < start) end += 24 * 60; // overnight
  return end - start;
}