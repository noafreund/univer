const TZ = 'Asia/Jerusalem';

/** Current Israel local time as { date: 'YYYY-MM-DD', time: 'HH:MM' }. */
export function nowParts(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function todayIso() {
  return nowParts().date;
}

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/** 'YYYY-MM-DD' -> '6.7.25' (the format used in the office). */
export function fmtDate(iso: string | null | undefined, withWeekday = false): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y) return iso;
  const s = `${d}.${m}.${String(y).slice(2)}`;
  if (!withWeekday) return s;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `יום ${WEEKDAYS[wd]} ${s}`;
}

export function fmtTime(isoDateTime: string | null | undefined): string {
  return isoDateTime?.slice(11, 16) ?? '';
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Sunday-based start of week (Israeli work week). */
export function startOfWeek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(iso, -wd);
}

function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Moves Friday/Saturday to Sunday (Israeli work week). */
export function toWorkday(iso: string): string {
  const wd = weekday(iso);
  if (wd === 5) return addDays(iso, 2);
  if (wd === 6) return addDays(iso, 1);
  return iso;
}

/**
 * The next follow-up date for a meeting-tracking state.
 * `chosen` is used for "on a specific date" (and as an optional override for "I owe them an answer").
 */
export function followUpFor(state: string, from: string, chosen?: string | null): string | null {
  switch (state) {
    case 'retry_tomorrow':
      return toWorkday(addDays(from, 1));
    case 'retry_next_week':
      return toWorkday(addDays(from, 7));
    case 'they_call_back':
      return toWorkday(addDays(from, 10));
    case 'retry_on_date':
      return chosen || toWorkday(addDays(from, 1));
    case 'i_owe_answer':
      return chosen || from;
    default:
      return null;
  }
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400_000);
}
