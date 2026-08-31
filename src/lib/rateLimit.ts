import { prisma } from "@/lib/prisma";
export { getClientIp } from "@/lib/getClientIp";

// How long a hit stays around before it's eligible for pruning — generous
// headroom above any caller's actual window (currently at most 1 hour) so
// pruning never races a legitimate check.
const HIT_RETENTION_MS = 24 * 60 * 60 * 1000;

// Read-only: has this key already hit its limit within the window? Callers
// decide separately (via recordHit) whether this particular attempt counts
// toward the limit — e.g. a failed login should count, a successful one
// shouldn't, so the two can't be combined into one "check and record" call.
export async function isRateLimited(key: string, maxHits: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } });
  return count >= maxHits;
}

// Records one attempt against `key`, and opportunistically prunes that
// key's stale rows — keeps the table small without a separate cron job.
export async function recordHit(key: string): Promise<void> {
  const staleBefore = new Date(Date.now() - HIT_RETENTION_MS);
  await Promise.all([
    prisma.rateLimitHit.create({ data: { key } }),
    prisma.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: staleBefore } } }),
  ]);
}
