import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { setCustomChallengeFilms } from "@/lib/challenges";
import { pickedFilmsSchema } from "@/lib/pickedFilmsSchema";

const bodySchema = z.object({ films: pickedFilmsSchema });

// Replaces the films in one of your hand-picked challenges.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid films" },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const updated = await setCustomChallengeFilms(session.user.id, id, parsed.data.films);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
