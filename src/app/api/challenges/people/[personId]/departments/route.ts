import { NextResponse } from "next/server";
import { auth } from "@/auth";
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
// choices ("Directing (24)") instead of a generic fixed list.
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

  const byDepartment = new Map<string, number>();
  for (const credit of credits.crew) {
    byDepartment.set(credit.department, (byDepartment.get(credit.department) ?? 0) + 1);
  }
  // Re-count after dedupe so a person credited twice on one film (e.g.
  // director + writer within the same department) isn't over-counted.
  for (const [department] of byDepartment) {
    const list = credits.crew.filter((c) => c.department === department);
    byDepartment.set(department, dedupeById(list).length);
  }

  const departments = [...byDepartment.entries()]
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  const actingCount = dedupeById(credits.cast).length;
  if (actingCount > 0) departments.push({ department: "Acting", count: actingCount });

  return NextResponse.json({ departments });
}
