// Exam dates are India calendar days, not instants. They are formatted from their parts so a device in another
// time zone never shows the day before. Instants (like "checked at") are shown as India dates.
const IST = "Asia/Kolkata";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const withZone = (iso: string) => (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);

/** The India calendar day of an instant, as YYYY-MM-DD. */
export const istDay = (iso: string | Date): string => dayFmt.format(typeof iso === "string" ? new Date(withZone(iso)) : iso);
export const todayIst = (): string => istDay(new Date());

/** Whole days between an instant and now, by India calendar day. */
export function daysSince(iso: string): number {
  const a = new Date(`${istDay(iso)}T00:00:00Z`).getTime();
  const b = new Date(`${todayIst()}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "Checked 3 Oct 2026 (12 days ago)". */
export function checkedLabel(iso: string): string {
  const d = daysSince(iso);
  return `${formatDay(istDay(iso))} (${d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`})`;
}
