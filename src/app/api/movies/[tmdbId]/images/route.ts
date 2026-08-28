import { NextResponse } from "next/server";
import { getMovieImages } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const { tmdbId } = await context.params;

  try {
    const images = await getMovieImages(Number(tmdbId));
    return NextResponse.json(images);
  } catch {
    return NextResponse.json({ error: "Couldn't load poster options" }, { status: 502 });
  }
}
