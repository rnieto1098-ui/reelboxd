export function yearBounds(year: number) {
  return {
    start: new Date(`${year}-01-01T00:00:00.000Z`),
    end: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
}

// The "current year" every year-scoped feature has to agree on. Plain
// getFullYear() reads the server's local year, which disagrees with
// yearBounds() and checkGoalJustCompleted() (both UTC) for a few hours
// around New Year on any server behind UTC — long enough to show last
// year's goal widget while new watches are already counting toward the
// next year's goal.
export function currentYearUTC(): number {
  return new Date().getUTCFullYear();
}

// Wide enough for any diary entry a real person could log (a Letterboxd
// import can carry genuinely old backdated watches) while still keeping
// yearBounds on four-digit years that parse to valid Dates.
const MIN_BROWSABLE_YEAR = 1900;
const MAX_BROWSABLE_YEAR = 2100;

/**
 * Reads a `?year=` search param, or null if it isn't a usable year.
 *
 * The integer check is the point. `Number.isFinite` accepts `1.5`, and a
 * fractional year flows straight into `prisma.watchGoal.findUnique` against
 * an `Int` column — which throws a validation error and takes the whole page
 * down — and into `yearBounds`, where it builds the unparseable
 * `"1.5-01-01T00:00:00.000Z"`. The bounds catch the same problem from the
 * other end: `?year=1e21` is a perfectly good integer that still produces an
 * Invalid Date. `/api/goals` already parses its own year this way (see the
 * note there about `Number(null)` being a finite 0); this is that rule
 * shared, so the pages agree with the API.
 */
export function parseYearParam(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (year < MIN_BROWSABLE_YEAR || year > MAX_BROWSABLE_YEAR) return null;
  return year;
}

// Human-readable countdown for a TIMEFRAME challenge's deadline. `now`
// defaults to the real current time but is a parameter so callers (and
// tests) can pin it.
export function formatTimeLeft(endDate: Date, now: Date = new Date()): string {
  const msLeft = endDate.getTime() - now.getTime();
  if (msLeft <= 0) return "Time's up";

  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft === 1) return "1 day left";
  if (daysLeft < 14) return `${daysLeft} days left`;
  if (daysLeft < 60) return `${Math.round(daysLeft / 7)} weeks left`;
  return `${Math.round(daysLeft / 30)} months left`;
}

// ---------------------------------------------------------------------------
// Calendar dates ("YYYY-MM-DD"), the form a watch date travels in between
// the browser and the server.
//
// A diary entry belongs to the day the viewer watched the film *where they
// are*. The server only knows the UTC date, which is already tomorrow for
// someone in the Americas logging in the evening, so the browser sends its
// own date as a plain string and the server stores it at UTC midnight (the
// same convention the Letterboxd import and sync already use).
// ---------------------------------------------------------------------------

/** Today (or `date`) in the device's own timezone, as "YYYY-MM-DD". */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// No film could have been watched before films existed.
const EARLIEST_WATCH_YEAR = 1888;

/**
 * Turns a client-supplied "YYYY-MM-DD" into the UTC-midnight Date it is
 * stored as, or null if it isn't a real, plausible watch date.
 *
 * Rejects: anything not in that exact shape, impossible dates ("2026-02-31",
 * which `new Date` would quietly roll into March), dates before film
 * existed, and dates more than a day ahead of the server's clock (one day of
 * slack covers every timezone that is already on tomorrow).
 */
export function parseCalendarDate(value: unknown, now: Date = new Date()): Date | null {
  if (typeof value !== "string") return null;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  if (year < EARLIEST_WATCH_YEAR) return null;
  const latest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (date > latest) return null;
  return date;
}
