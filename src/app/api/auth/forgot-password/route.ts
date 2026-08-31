import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, isRateLimited, recordHit } from "@/lib/rateLimit";
import { sendPasswordResetEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/siteUrl";

const schema = z.object({ email: z.string().email() });

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_LIMIT = 3;
const REQUEST_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Always responds the same way (200, generic message) whether or not the
// email is registered, whether or not it's rate limited, and whether or not
// the send actually succeeds — any of those leaking through the response
// would turn this endpoint into a way to enumerate registered accounts or
// probe for the rate limit.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const ip = getClientIp(request);
  // Keyed by IP and email together — either alone is gameable (one IP
  // cycling through many target emails, or one email requested via many
  // IPs), together it takes both to exhaust the limit.
  const rateLimitKey = `forgot-password:${ip}:${email}`;

  if (!(await isRateLimited(rateLimitKey, REQUEST_LIMIT, REQUEST_WINDOW_MS))) {
    await recordHit(rateLimitKey);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Drop any outstanding token first so an old, possibly-leaked reset
      // link stops working the moment a new one is requested.
      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      const token = randomBytes(32).toString("hex");
      await prisma.verificationToken.create({
        data: { identifier: email, token, expires: new Date(Date.now() + TOKEN_TTL_MS) },
      });

      const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl).catch((err) =>
        console.error("Failed to send password reset email", err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}
