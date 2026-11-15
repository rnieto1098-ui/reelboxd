import { prisma } from "@/lib/prisma";
import { syncLetterboxdDiary } from "@/lib/letterboxdSync";
import {
  syncLetterboxdWatchlist,
  LetterboxdWatchlistBrokenError,
} from "@/lib/letterboxdWatchlistSync";
import { sendLetterboxdWatchlistBrokenEmail } from "@/lib/email";
import { runProviderSnapshot } from "@/lib/providerSnapshot";

// The site's background jobs, in one place.
//
// Each is run two ways: on a schedule by the hosting provider (the
// /api/cron/* routes, see vercel.json) and by hand from the admin area.
// Both go through runJob below, which records every run in the JobRun
// table, so "did last night's sync happen, and did it work?" has an answer
// on a page instead of only in the hosting provider's logs.

export const JOB_KEYS = [
  "letterboxd-sync",
  "letterboxd-watchlist-sync",
  "provider-snapshot",
  "maintenance",
] as const;
export type JobKey = (typeof JOB_KEYS)[number];

export function isJobKey(value: unknown): value is JobKey {
  return typeof value === "string" && (JOB_KEYS as readonly string[]).includes(value);
}

const SYNC_CONCURRENCY = 3;

// Runs `work` for each item, a few at a time, and never lets one failure
// stop the rest. Returns how many succeeded and failed.
async function forEachLimited<T>(
  items: T[],
  work: (item: T) => Promise<void>
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += SYNC_CONCURRENCY) {
    const batch = items.slice(i, i + SYNC_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(work));
    for (const result of results) {
      if (result.status === "fulfilled") ok++;
      else failed++;
    }
  }
  return { ok, failed };
}

async function syncAllDiaries(): Promise<string> {
  const users = await prisma.user.findMany({
    where: { letterboxdUsername: { not: null } },
    select: { id: true, letterboxdUsername: true },
  });
  let imported = 0;
  const { ok, failed } = await forEachLimited(users, async (user) => {
    const summary = await syncLetterboxdDiary(user.id, user.letterboxdUsername!);
    imported += summary.imported;
  });
  return `${ok} account${ok === 1 ? "" : "s"} synced, ${imported} new diary entr${
    imported === 1 ? "y" : "ies"
  }${failed > 0 ? `, ${failed} failed` : ""}`;
}

async function syncAllWatchlists(): Promise<string> {
  const users = await prisma.user.findMany({
    where: { letterboxdUsername: { not: null } },
    select: {
      id: true,
      email: true,
      letterboxdUsername: true,
      letterboxdWatchlistSyncBroken: true,
    },
  });
  let added = 0;
  const { ok, failed } = await forEachLimited(users, async (user) => {
    try {
      const summary = await syncLetterboxdWatchlist(user.id, user.letterboxdUsername!);
      added += summary.added;
    } catch (error) {
      // The first time a user's watchlist page can't be read at all, mark
      // it and tell them once by email (not on every later failed run).
      if (error instanceof LetterboxdWatchlistBrokenError && !user.letterboxdWatchlistSyncBroken) {
        await prisma.user
          .update({ where: { id: user.id }, data: { letterboxdWatchlistSyncBroken: true } })
          .catch(() => null);
        await sendLetterboxdWatchlistBrokenEmail(user.email, user.letterboxdUsername!).catch(
          () => null
        );
      }
      throw error;
    }
  });
  return `${ok} account${ok === 1 ? "" : "s"} synced, ${added} film${
    added === 1 ? "" : "s"
  } added to watchlists${failed > 0 ? `, ${failed} failed` : ""}`;
}

async function snapshotProviders(): Promise<string> {
  const { scanned, additions } = await runProviderSnapshot();
  return `${scanned} film${scanned === 1 ? "" : "s"} checked, ${additions} new streaming arrival${
    additions === 1 ? "" : "s"
  }`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Housekeeping for tables that only ever grow.
async function maintenance(): Promise<string> {
  const now = Date.now();
  const [hits, tokens, runs] = await Promise.all([
    // Rate-limit records are only ever looked at within an hour of being
    // written. They were pruned per key as that key was reused, so one-off
    // keys (a sign-up attempt from an address never seen again) stayed forever.
    prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now - DAY_MS) } } }),
    // Password-reset links that have expired unused.
    prisma.verificationToken.deleteMany({ where: { expires: { lt: new Date(now) } } }),
    // Job history older than three months.
    prisma.jobRun.deleteMany({ where: { startedAt: { lt: new Date(now - 90 * DAY_MS) } } }),
  ]);
  return `Removed ${hits.count} old rate-limit record${hits.count === 1 ? "" : "s"}, ${
    tokens.count
  } expired reset link${tokens.count === 1 ? "" : "s"}, ${runs.count} old job record${
    runs.count === 1 ? "" : "s"
  }`;
}

export const JOBS: Record<
  JobKey,
  { label: string; description: string; schedule: string; run: () => Promise<string> }
> = {
  "letterboxd-sync": {
    label: "Letterboxd diary sync",
    description: "Copies new Letterboxd diary entries for every connected account.",
    schedule: "Daily at 08:00 UTC",
    run: syncAllDiaries,
  },
  "letterboxd-watchlist-sync": {
    label: "Letterboxd watchlist sync",
    description: "Adds films newly saved on Letterboxd to each connected account's watchlist.",
    schedule: "Daily at 10:00 UTC",
    run: syncAllWatchlists,
  },
  "provider-snapshot": {
    label: "Streaming availability check",
    description:
      "Checks where every watchlisted or owned film is streaming and records new arrivals.",
    schedule: "Daily at 11:00 UTC",
    run: snapshotProviders,
  },
  maintenance: {
    label: "Housekeeping",
    description: "Clears out expired rate-limit records, reset links and old job history.",
    schedule: "Daily, after the availability check",
    run: maintenance,
  },
};

const SUMMARY_MAX_LENGTH = 300;

/**
 * Runs a job and records it. Never throws: a failed job is reported as
 * `ok: false` with the error as its summary, and that is what gets stored,
 * so a broken job shows up in the admin area rather than vanishing.
 */
export async function runJob(
  key: JobKey,
  trigger: "cron" | "admin"
): Promise<{ ok: boolean; summary: string }> {
  // If even the log row can't be written, still run the job: the work
  // matters more than the record of it.
  const run = await prisma.jobRun.create({ data: { job: key, trigger } }).catch(() => null);

  let ok = true;
  let summary: string;
  try {
    summary = await JOBS[key].run();
  } catch (error) {
    ok = false;
    summary = error instanceof Error ? error.message : "Unknown error";
    console.error(`Job ${key} failed:`, error);
  }
  summary = summary.slice(0, SUMMARY_MAX_LENGTH);

  if (run) {
    await prisma.jobRun
      .update({ where: { id: run.id }, data: { finishedAt: new Date(), ok, summary } })
      .catch(() => null);
  }
  return { ok, summary };
}
