"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { posterUrl, type TmdbImage } from "@/lib/tmdb";

export function PosterPicker({
  tmdbId,
  hasCustomPoster,
}: {
  tmdbId: number;
  hasCustomPoster: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posters, setPosters] = useState<TmdbImage[] | null>(null);

  useEffect(() => {
    if (!open || posters) return;

    // Initiating a fetch is exactly what an effect is for — the setState
    // calls here aren't "deriving" state from a prop, they're kicking off
    // and tracking a real network request (loading/error/result), which
    // can't happen during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch trigger, not a derived-state effect
    setLoading(true);
    setError(null);
    fetch(`/api/movies/${tmdbId}/images`)
      .then((res) => res.json())
      .then((data) => setPosters(data.posters ?? []))
      .catch(() => setError("Couldn't load poster options."))
      .finally(() => setLoading(false));
  }, [open, posters, tmdbId]);

  async function choosePoster(posterPath: string) {
    setSaving(true);
    await fetch(`/api/movies/${tmdbId}/poster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posterPath }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function resetPoster() {
    setSaving(true);
    await fetch(`/api/movies/${tmdbId}/poster`, { method: "DELETE" });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted hover:text-accent-green hover:underline"
      >
        Change poster
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Choose a poster</h3>
              <div className="flex items-center gap-3">
                {hasCustomPoster && (
                  <button
                    type="button"
                    onClick={resetPoster}
                    disabled={saving}
                    className="text-xs text-muted hover:text-foreground disabled:opacity-50"
                  >
                    Use original
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>

            {loading && <p className="text-sm text-muted">Loading posters...</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}

            {posters && posters.length === 0 && (
              <p className="text-sm text-muted">No alternate posters found for this movie.</p>
            )}

            {posters && posters.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {posters.map((img) => (
                  <button
                    key={img.file_path}
                    type="button"
                    disabled={saving}
                    onClick={() => choosePoster(img.file_path)}
                    className="overflow-hidden rounded-md border border-border transition-colors hover:border-accent-green disabled:opacity-50"
                  >
                    <Image
                      src={posterUrl(img.file_path, "w200")!}
                      alt=""
                      width={200}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
