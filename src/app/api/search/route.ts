import { NextResponse } from "next/server";
import { posterUrl, searchMovies } from "@/lib/tmdb";
import { cleanMovieList } from "@/lib/movieListHygiene";

const MAX_SUGGESTIONS = 8;
const MAX_QUERY_LENGTH = 100;

export type SearchSuggestion = {
  id: number;
  title: string;
  year: string;
  poster: string | null;
};

// Powers the header search box's as-you-type dropdown. Public, like the
// /search page it previews; the full results page does the rest.
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return NextResponse.json({ results: [] });

  let results: SearchSuggestion[];
  try {
    const data = await searchMovies(query);
    results = cleanMovieList(data.results)
      .slice(0, MAX_SUGGESTIONS)
      .map((m) => ({
        id: m.id,
        title: m.title,
        year: m.release_date?.slice(0, 4) ?? "",
        poster: posterUrl(m.poster_path, "w200"),
      }));
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now" }, { status: 502 });
  }

  return NextResponse.json(
    { results },
    // Same query → same answer for a while; lets the browser/CDN absorb
    // repeat keystrokes (typing, deleting, retyping) without hitting TMDB.
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }
  );
}
