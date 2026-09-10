import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createChallenge } from "@/lib/challenges";

// Trimmed and capped, but otherwise optional — an omitted or blank title
// falls back to the auto-generated one in createChallenge.
const titleField = z.string().trim().max(100).optional();

const challengeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("GENRE"),
    genreName: z.string().min(1).max(50),
    target: z.number().int().min(1).max(10000),
    title: titleField,
  }),
  z.object({
    type: z.literal("TIMEFRAME"),
    startDate: z.string(),
    endDate: z.string(),
    target: z.number().int().min(1).max(10000),
    title: titleField,
  }),
  z.object({
    type: z.literal("CREW"),
    personId: z.number().int().positive(),
    personName: z.string().min(1).max(200),
    department: z.string().min(1).max(50).nullable(),
    title: titleField,
  }),
  z.object({
    type: z.literal("LIST"),
    listId: z.string().min(1),
    title: titleField,
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
      title: data.title,
    });
    return NextResponse.json(challenge, { status: 201 });
  }

  if (data.type === "LIST") {
    // Any list you can open is fair game — system lists have no owner and
    // another user's list is already publicly viewable — so this only has to
    // confirm it exists, and reads the title here rather than trusting a
    // client-supplied one.
    const list = await prisma.list.findUnique({
      where: { id: data.listId },
      select: { id: true, title: true },
    });
    if (!list) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // One-click creation makes a double-click easy, and two identical
    // challenges for the same list would be pure noise — hand back the one
    // that already exists instead.
    const existing = await prisma.challenge.findFirst({
      where: { userId: session.user.id, type: "LIST", listId: list.id },
    });
    if (existing) {
      return NextResponse.json({ ...existing, alreadyExisted: true });
    }

    // The check above and this create aren't atomic, and a double-click is
    // exactly how you'd hit the gap. @@unique([userId, type, listId]) is the
    // real guarantee; losing the race lands here, where handing back the row
    // the winner created gives the loser the same response the pre-check
    // would have.
    try {
      const challenge = await createChallenge(session.user.id, {
        type: "LIST",
        listId: list.id,
        listTitle: list.title,
        title: data.title,
      });
      return NextResponse.json(challenge, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await prisma.challenge.findFirst({
          where: { userId: session.user.id, type: "LIST", listId: list.id },
        });
        if (winner) return NextResponse.json({ ...winner, alreadyExisted: true });
      }
      throw error;
    }
  }

  const challenge = await createChallenge(session.user.id, data);
  return NextResponse.json(challenge, { status: 201 });
}
