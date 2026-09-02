import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPersonMovieCredits } from "@/lib/tmdb";

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Map<number, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

// Lists the departments (plus "Acting") this person actually has movie
// credits in, with counts — so the challenge form can offer only real
// choices ("Directing (24)") instead of a generic fixed list. Also reports
// how many of each department's credits the signed-in user has already
// logged, for the form's live "you've already watched N of these" preview.
export async function GET(
  _request: Request,
  context: { params: Promise<{ personId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { personId: personIdParam } = await context.params;
  const personId = Number(personIdParam);
  if (!Number.isFinite(personId)) {
    return NextResponse.json({ error: "Invalid person" }, { status: 400 });
  }

  const credits = await getPersonMovieCredits(personId).catch(() => ({ cast: [], crew: [] }));

  const byDepartment = new Map<string, { id: number }[]>();
  for (const department of new Set(credits.crew.map((c) => c.department))) {
    byDepartment.set(department, dedupeById(credits.crew.filter((c) => c.department === department)));
  }
  const actingCredits = dedupeById(credits.cast);
  if (actingCredits.length > 0) byDepartment.set("Acting", actingCredits);

  const allTmdbIds = [...new Set([...byDepartment.values()].flat().map((c) => c.id))];
  const logged =
    allTmdbIds.length > 0
      ? await prisma.diaryEntry.findMany({
          where: { userId: session.user.id, movie: { tmdbId: { in: allTmdbIds } } },
          select: { movie: { select: { tmdbId: true } } },
          distinct: ["movieId"],
        })
      : [];
  const loggedTmdbIds = new Set(logged.map((l) => l.movie.tmdbId));

  const departments = [...byDepartment.entries()]
    .map(([department, list]) => ({
      department,
      count: list.length,
      watched: list.filter((c) => loggedTmdbIds.has(c.id)).length,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ departments });
}
