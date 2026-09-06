import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { setGoal, clearGoal } from "@/lib/goals";

const yearSchema = z.number().int().min(2000).max(2100);

const goalSchema = z.object({
  year: yearSchema,
  target: z.number().int().min(1).max(10000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid goal" },
      { status: 400 }
    );
  }

  const goal = await setGoal(session.user.id, parsed.data.year, parsed.data.target);
  return NextResponse.json(goal);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Parsed through the same schema the POST uses, rather than a bare
  // Number.isFinite check — a missing ?year= reads as null, and Number(null)
  // is a perfectly finite 0, which slipped through and cleared "year 0".
  const raw = new URL(request.url).searchParams.get("year");
  const parsed = yearSchema.safeParse(raw === null ? null : Number(raw));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  const year = parsed.data;

  await clearGoal(session.user.id, year);
  return NextResponse.json({ ok: true });
}
