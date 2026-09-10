// No next/server import here (unlike most route helpers) — dependency-free
// like getClientIp.ts and streamingAvailability.ts, specifically so this can
// be unit tested directly with plain `node --test` instead of needing
// Next's own module resolution.

/**
 * Whether a request is a legitimate cron trigger, shared by the three
 * /api/cron/* routes (see vercel.json). Vercel signs its own cron requests
 * with `Authorization: Bearer $CRON_SECRET`, which is how a real trigger is
 * told apart from anyone who finds the URL.
 *
 * Fails closed in production: a request without a valid header is rejected,
 * and so is every request when CRON_SECRET itself isn't configured — a
 * missing secret should mean "nobody can trigger this," not "anybody can."
 * (These routes used to do the latter, silently, if the env var was ever
 * left unset on a deploy.) Local dev stays permissive with CRON_SECRET
 * unset, matching every other optional-locally env var in this app (see
 * .env.example), so testing a cron route doesn't require minting a fake
 * secret first.
 *
 * `env` defaults to the real process.env and exists so tests can pass a
 * plain object instead — NODE_ENV is typed read-only on process.env itself,
 * and this is simpler than reassigning process.env wholesale per test.
 */
export function isAuthorizedCronRequest(
  request: Request,
  env: { CRON_SECRET?: string; NODE_ENV?: string } = process.env
): boolean {
  if (env.CRON_SECRET) {
    return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  }
  return env.NODE_ENV !== "production";
}
