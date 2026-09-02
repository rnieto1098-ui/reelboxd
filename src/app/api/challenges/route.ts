import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createChallenge } from "@/lib/challenges";

const challengeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("GENRE"),
    genreName: z.string().min(1).max(50),
    target: z.number().int().min(1).max(10000),
  }),
  z.object({
    type: z.literal("TIMEFRAME"),
    startDate: z.string(),
    endDate: z.string(),
    target: z.number().int().min(1).max(10000),
  }),
  z.object({
    type: z.literal("CREW"),
    personId: z.number().int().positive(),
    personName: z.string().min(1).max(200),
    department: z.string().min(1).max(50).nullable(),
  }),
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid challenge" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.type === "TIMEFRAME") {
    // Parsed as explicit UTC boundaries of the selected calendar days (not
    // just midnight-to-midnight) so a diary entry logged any time on the end
    // date still counts, and so formatting it back out doesn't shift a day
    // depending on the server's local timezone.
    const startDate = new Date(`${data.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${data.endDate}T23:59:59.999Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const challenge = await createChallenge(session.user.id, {
      type: "TIMEFRAME",
      startDate,
      endDate,
      target: data.target,
    });
    return NextResponse.json(challenge, { status: 201 });
  }

  const challenge = await createChallenge(session.user.id, data);
  return NextResponse.json(challenge, { status: 201 });
}
