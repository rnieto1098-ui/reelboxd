"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Dialog } from "@/components/Dialog";

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
        className="btn btn-ghost btn-sm"
      >
        <ShieldAlert aria-hidden className="h-4 w-4" />
        Content advisory
      </button>

      {open && (
        <Dialog title="Content advisory" onClose={() => setOpen(false)} size="sm">
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
        </Dialog>
      )}
    </>
  );
}
