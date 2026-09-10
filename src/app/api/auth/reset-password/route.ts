import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, isRateLimited, recordHit } from "@/lib/rateLimit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const RESET_LIMIT = 10;
const RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  // Keyed by IP, not by token — an attacker guessing tokens would just use a
  // new one each try, so throttling per token would limit nothing. The
  // token's 256 bits of entropy (randomBytes(32) in forgot-password) already
  // make guessing hopeless; this is defence in depth, and closes the one gap
  // in the convention every other auth route follows.
  const ip = getClientIp(request);
  const rateLimitKey = `reset-password:${ip}`;
  if (await isRateLimited(rateLimitKey, RESET_LIMIT, RESET_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }
  await recordHit(rateLimitKey);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  // One-time use — the token is consumed in the same transaction as the
  // password update, so a link can't be replayed even if intercepted.
  await prisma.$transaction([
    prisma.user.update({ where: { email: record.identifier }, data: { hashedPassword } }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return NextResponse.json({ ok: true });
}
