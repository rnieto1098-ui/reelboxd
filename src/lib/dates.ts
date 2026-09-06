export function yearBounds(year: number) {
  return {
    start: new Date(`${year}-01-01T00:00:00.000Z`),
    end: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
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
