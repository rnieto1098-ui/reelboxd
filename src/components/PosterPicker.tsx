"use client";

import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { posterUrl, type TmdbImage } from "@/lib/tmdb";

export function PosterPicker({
  tmdbId,
  hasCustomPoster,
}: {
  tmdbId: number;
  hasCustomPoster: boolean;
}) {
  const router = useRouter();
  const showToast = useToast();
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

    let res: Response;
    try {
      res = await fetch(`/api/movies/${tmdbId}/poster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posterPath }),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't set that poster — try again.", "error");
      return;
    }

    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't set that poster — try again.", "error");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function resetPoster() {
    setSaving(true);

    let res: Response;
    try {
      res = await fetch(`/api/movies/${tmdbId}/poster`, { method: "DELETE" });
    } catch {
      setSaving(false);
      showToast("Couldn't reset the poster — try again.", "error");
      return;
    }

    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't reset the poster — try again.", "error");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
      >
        <ImagePlus aria-hidden className="h-4 w-4" />
        Change poster
      </button>

      {open && (
        <Dialog
          title="Choose a poster"
          onClose={() => setOpen(false)}
          size="lg"
          footer={
            hasCustomPoster ? (
              <button
                type="button"
                onClick={resetPoster}
                disabled={saving}
                className="btn btn-outline btn-sm"
              >
                Use the original poster
              </button>
            ) : undefined
          }
        >
            <p className="mb-3 text-sm text-muted">
              Only you see the poster you pick. It replaces the default everywhere this film
              appears.
            </p>
            {loading && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton aspect-[2/3]" />
                ))}
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}

            {posters && posters.length === 0 && (
              <p className="text-sm text-muted">No alternate posters found for this movie.</p>
            )}

            {posters && posters.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {posters.map((img, index) => (
                  <button
                    key={img.file_path}
                    type="button"
                    disabled={saving}
                    onClick={() => choosePoster(img.file_path)}
                    aria-label={`Use poster option ${index + 1}`}
                    className="overflow-hidden rounded-lg ring-1 ring-white/10 transition-[box-shadow,transform] hover:scale-[1.02] hover:ring-2 hover:ring-accent-green disabled:opacity-50"
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
        </Dialog>
      )}
    </>
  );
}
