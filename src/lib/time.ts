export const TZ = 'Asia/Kolkata';

/** YYYY-MM-DD in India time. */
export function istDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** e.g. "03:25:10 pm" in India time. */
export function istTime(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(d);
}

/** UTC instants bounding one India-local calendar day (IST has no DST). */
export function istDayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
