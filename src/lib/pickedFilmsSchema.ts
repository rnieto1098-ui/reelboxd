import { z } from "zod";
import type { PickedFilm } from "@/lib/challenges";

export const MAX_PICKED_FILMS = 500;

// The films a hand-picked challenge is made of, as the form sends them.
// A film picked twice is kept once, in the place it was first picked.
export const pickedFilmsSchema = z
  .array(
    z.object({
      tmdbId: z.number().int().positive(),
      title: z.string().trim().min(1).max(300),
      posterPath: z.string().max(200).nullable(),
      releaseDate: z.string().max(20).nullable(),
    })
  )
  .min(1, "Pick at least one film")
  .max(MAX_PICKED_FILMS, `A challenge can have up to ${MAX_PICKED_FILMS} films`)
  .transform((films): PickedFilm[] => {
    const seen = new Set<number>();
    return films.filter((f) => !seen.has(f.tmdbId) && seen.add(f.tmdbId));
  });
