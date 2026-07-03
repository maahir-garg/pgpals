// All event times are stored in UTC (timestamptz) and displayed in
// Asia/Singapore. Singapore has no daylight saving, so the +08:00 offset is
// constant and safe to hard-code for form conversions.

const SGT = "Asia/Singapore";

export function formatSGT(
  iso: string | Date,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: SGT,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...opts,
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatSGTDate(iso: string | Date): string {
  return formatSGT(iso, { hour: undefined, minute: undefined });
}

// "2026-07-05T18:30" (from <input type="datetime-local">, meant as SGT) -> UTC ISO
export function sgtInputToUtc(value: string): string {
  return new Date(`${value}:00+08:00`).toISOString();
}

// UTC ISO -> "2026-07-05T18:30" for <input type="datetime-local"> in SGT
export function utcToSgtInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export type Countdown = { label: string; urgent: boolean };

// Human countdown to a deadline, e.g. "2d 4h left", "35m left", "Closed".
export function countdownTo(deadlineIso: string, now = new Date()): Countdown {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  if (ms <= 0) return { label: "Closed", urgent: false };
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 2) return { label: `${days}d left`, urgent: false };
  if (days >= 1) return { label: `${days}d ${hours % 24}h left`, urgent: true };
  if (hours >= 1) return { label: `${hours}h ${mins % 60}m left`, urgent: true };
  return { label: `${mins}m left`, urgent: true };
}

export function isClosingSoon(deadlineIso: string, now = new Date()): boolean {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  return ms > 0 && ms <= 48 * 60 * 60 * 1000;
}
