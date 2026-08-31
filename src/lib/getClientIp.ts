// Split out from rateLimit.ts (which needs prisma) so this — a pure,
// dependency-free function — can be unit tested without any DB/env setup.
// Vercel (and most proxies) forward the real client IP via x-forwarded-for,
// as a comma-separated list with the original client first.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
