import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp, isRateLimited, recordHit } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/normalizeEmail";

const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const signupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitKey = `signup:${ip}`;
  if (await isRateLimited(rateLimitKey, SIGNUP_LIMIT, SIGNUP_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 }
    );
  }
  await recordHit(rateLimitKey);

  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { username, password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email or username already exists" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // The check above and this create aren't one atomic step. Two signups
  // racing for the same email or username both clear the check, and the
  // loser hits the @unique constraint on User.email / User.username — which
  // without this would surface as an uncaught P2002 and a bare 500, for what
  // is really just the "already taken" case the check above already handles.
  // Same shape of fix as the diary PATCH route's duplicate-day handling.
  try {
    await prisma.user.create({
      data: { username, email, hashedPassword },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An account with that email or username already exists" },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
