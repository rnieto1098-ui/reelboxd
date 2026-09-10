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
