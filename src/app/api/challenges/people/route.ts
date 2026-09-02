import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchPeople } from "@/lib/tmdb";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ results: [] });

  const { results } = await searchPeople(query).catch(() => ({ results: [] }));
  return NextResponse.json({
    results: results.slice(0, 10).map((p) => ({
      id: p.id,
      name: p.name,
      profile_path: p.profile_path,
      known_for_department: p.known_for_department ?? null,
    })),
  });
}
