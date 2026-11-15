// Pure helpers for how a challenge or goal is presented. Kept free of
// database imports so they can be unit tested directly with `node --test`.

export type ChallengeStatus = "active" | "complete" | "ended";

/**
 * Where a challenge stands:
 *  - "complete": the target has been met (even if its window has since closed)
 *  - "ended":    a date-range challenge whose window closed short of the target
 *  - "active":   everything else
 */
export function challengeStatus(
  challenge: { type: string; percent: number | null; endDate: Date | null },
  now: Date = new Date()
): ChallengeStatus {
  if (challenge.percent != null && challenge.percent >= 100) return "complete";
  if (
    challenge.type === "TIMEFRAME" &&
    challenge.endDate &&
    challenge.endDate.getTime() < now.getTime()
  ) {
    return "ended";
  }
  return "active";
}

/**
 * Whether a film with this TMDB release date ("YYYY-MM-DD", or empty when
 * unannounced) is out yet. `today` is also "YYYY-MM-DD"; ISO dates compare
 * correctly as plain strings.
 */
export function isReleased(releaseDate: string | null | undefined, today: string): boolean {
  return !!releaseDate && releaseDate <= today;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One line on how a yearly watch goal is going, or null when there is
 * nothing useful to say (no goal, or a year that isn't the current one).
 *
 * Compares films logged so far with where an even pace through the year
 * would have you today, then says how many a week it takes to finish.
 */
export function goalPace(
  goal: { year: number; target: number | null; count: number },
  now: Date = new Date()
): string | null {
  if (goal.target == null || goal.target <= 0) return null;
  if (now.getUTCFullYear() !== goal.year) return null;
  const remaining = goal.target - goal.count;
  if (remaining <= 0) return "Goal reached. Everything from here is a bonus.";

  const yearStart = Date.UTC(goal.year, 0, 1);
  const yearEnd = Date.UTC(goal.year + 1, 0, 1);
  const daysLeft = Math.max(1, Math.ceil((yearEnd - now.getTime()) / DAY_MS));
  const elapsedShare = (now.getTime() - yearStart) / (yearEnd - yearStart);
  const expectedByNow = Math.floor(goal.target * elapsedShare);
  const ahead = goal.count - expectedByNow;

  const perWeek = (remaining / daysLeft) * 7;
  const rate =
    perWeek >= 1
      ? `about ${Math.ceil(perWeek)} a week`
      : `about one every ${Math.max(1, Math.round(daysLeft / remaining))} days`;
  const standing =
    ahead > 0
      ? `${ahead} ahead of pace`
      : ahead < 0
        ? `${-ahead} behind pace`
        : "right on pace";

  return `${remaining} to go, ${standing}. Finishing takes ${rate}.`;
}
