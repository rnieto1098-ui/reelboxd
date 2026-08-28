"use client";

import { useState } from "react";

// TMDB has no real structured content-advisory breakdown (no equivalent of
// IMDb's Parental Guidance categories, and its own `descriptors` field next
// to certifications is defined in the API schema but essentially never
// populated in practice — confirmed empty across several major titles
// before building this). Nudity specifically is one of the more
// consistently crowd-tagged keywords TMDB actually has real data for
// ("nudity", "female nudity", "full frontal nudity", "brief nudity", ...),
// so that's the honest, checkable signal used here instead of a full
// content breakdown.
function findNudityTags(keywords: string[]): string[] {
  return keywords.filter((kw) => kw.toLowerCase().includes("nud"));
}

export function ContentAdvisoryModal({
  certification,
  keywords,
}: {
  certification: string | null;
  keywords: string[];
}) {
  const [open, setOpen] = useState(false);

  const nudityTags = findNudityTags(keywords);
  const hasNudity = nudityTags.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent-green transition-colors"
      >
        Content Advisory
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">Content Advisory</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-xs text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {certification && (
                <p className="text-sm text-muted">
                  Rated{" "}
                  <span className="rounded border border-border px-2 py-0.5 font-medium text-foreground">
                    {certification}
                  </span>
                </p>
              )}

              <section>
                <h4 className="mb-1 text-sm font-semibold text-muted">Nudity</h4>
                {hasNudity ? (
                  <div className="flex flex-wrap gap-2">
                    {nudityTags.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full border border-accent-green px-2 py-1 text-xs capitalize text-accent-green"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm">No nudity flagged for this title.</p>
                )}
                <p className="mt-2 text-xs text-muted">
                  Based on community-submitted keyword tags from TMDB, not an official
                  guide — a title can still lack this tag even if it applies.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
