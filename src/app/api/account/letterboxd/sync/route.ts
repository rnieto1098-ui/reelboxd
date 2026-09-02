import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncLetterboxdDiary } from "@/lib/letterboxdSync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { letterboxdUsername: true },
  });
  if (!user?.letterboxdUsername) {
    return NextResponse.json({ error: "No Letterboxd account connected" }, { status: 400 });
  }

  try {
    const summary = await syncLetterboxdDiary(session.user.id, user.letterboxdUsername);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 502 }
    );
  }
}
