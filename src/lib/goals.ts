import { prisma } from "@/lib/prisma";
import { yearBounds } from "@/lib/dates";

export type GoalProgress = {
  year: number;
  target: number | null;
  count: number;
  percent: number | null;
};

export async function getGoalProgress(userId: string, year: number): Promise<GoalProgress> {
  const { start, end } = yearBounds(year);

  const [goal, count] = await Promise.all([
    prisma.watchGoal.findUnique({ where: { userId_year: { userId, year } } }),
    prisma.diaryEntry.count({
      where: { userId, watchedDate: { gte: start, lt: end } },
    }),
  ]);

  return {
    year,
    target: goal?.target ?? null,
    count,
    percent: goal && goal.target > 0 ? Math.min(100, Math.round((count / goal.target) * 100)) : null,
  };
}

export async function setGoal(userId: string, year: number, target: number) {
  return prisma.watchGoal.upsert({
    where: { userId_year: { userId, year } },
    update: { target },
    create: { userId, year, target },
  });
}

export async function clearGoal(userId: string, year: number) {
  await prisma.watchGoal.delete({ where: { userId_year: { userId, year } } }).catch(() => null);
}

// Called right after a diary entry is created, to say whether it just
// pushed the user's yearly goal to 100% — the count includes rewatches (see
// getGoalProgress), so it increases by exactly one per log, and "count now
// equals target" is enough to know this specific log was the one that did it.
export async function checkGoalJustCompleted(
  userId: string,
  watchedDate: Date
): Promise<{ year: number; target: number } | null> {
  // UTC, not local time — same convention as every other date bucketing in
  // this app (dayRangeUTC in diary.ts, yearBounds in dates.ts). A "log now"
  // entry is a raw `new Date()`, so a server running outside UTC could
  // otherwise credit a watch logged near a year boundary to the wrong
  // year's goal.
  const year = watchedDate.getUTCFullYear();
  const progress = await getGoalProgress(userId, year);
  if (progress.target != null && progress.count === progress.target) {
    return { year, target: progress.target };
  }
  return null;
}

export type CompletedGoal = { year: number; target: number };

// Bulk equivalent of checkGoalJustCompleted, for the Letterboxd import and
// sync — they used to call that once per imported row, which is both a
// query per row and wrong for a bulk write: the single-entry version keys
// off `count === target`, since one log moves the count by exactly one, but
// an import can jump straight past the target and never land on it. These
// two compare a before/after snapshot of every year the user has a goal
// for instead, so the whole import costs two passes rather than N.
export async function getCompletedGoals(userId: string): Promise<CompletedGoal[]> {
  const goals = await prisma.watchGoal.findMany({ where: { userId } });
  const progress = await Promise.all(
    goals.map(async (goal) => ({ goal, ...(await getGoalProgress(userId, goal.year)) }))
  );
  return progress
    .filter((p) => p.target != null && p.count >= p.target)
    .map((p) => ({ year: p.year, target: p.goal.target }));
}

export async function diffNewlyCompletedGoals(
  userId: string,
  completedBefore: CompletedGoal[]
): Promise<CompletedGoal | null> {
  const before = new Set(completedBefore.map((g) => g.year));
  const after = await getCompletedGoals(userId);
  // Only one gets surfaced, matching what the import already reported —
  // the most recent year is the one the user is most likely to care about.
  return after.filter((g) => !before.has(g.year)).sort((a, b) => b.year - a.year)[0] ?? null;
}
