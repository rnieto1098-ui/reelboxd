"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import Image from "next/image";
import Link from "next/link";
import { logoUrl, profileUrl, type TmdbGenre } from "@/lib/tmdb";

// Only the fields this dialog draws. The page used to pass TMDB's full
// credit records (a dozen fields each, for several hundred people) into the
// browser on every movie view, for a dialog that starts closed.
export type CreditsCrew = { id: number; name: string; job: string; department: string };
export type CreditsCast = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};
export type CreditsStudio = { id: number; name: string; logo_path: string | null };

const DEPARTMENT_ORDER = [
  "Directing",
  "Writing",
  "Production",
  "Camera",
  "Sound",
  "Editing",
  "Art",
  "Costume & Make-Up",
  "Visual Effects",
  "Crew",
];

export function AboutMovieModal({
  title,
  genres,
  studios,
  crew,
  cast,
}: {
  title: string;
  genres: TmdbGenre[];
  studios: CreditsStudio[];
  crew: CreditsCrew[];
  cast: CreditsCast[];
}) {
  const [open, setOpen] = useState(false);

  const crewByDepartment = new Map<string, CreditsCrew[]>();
  for (const member of crew) {
    const list = crewByDepartment.get(member.department) ?? [];
    list.push(member);
    crewByDepartment.set(member.department, list);
  }
  const orderedDepartments = [
    ...DEPARTMENT_ORDER.filter((d) => crewByDepartment.has(d)),
    ...[...crewByDepartment.keys()].filter((d) => !DEPARTMENT_ORDER.includes(d)),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
      >
        <Info aria-hidden className="h-4 w-4" />
        Full credits
      </button>

      {open && (
        <Dialog title={title} onClose={() => setOpen(false)} size="lg">
            <div className="space-y-6">
              {genres.length > 0 && (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-muted">Genres</h4>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => (
                      <span
                        key={g.id}
                        className="rounded-full border border-border px-2 py-1 text-xs"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {studios.length > 0 && (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-muted">Studios</h4>
                  <div className="flex flex-wrap gap-3">
                    {studios.map((s) => {
                      const logo = logoUrl(s.logo_path, "w92");
                      return (
                        <Link
                          key={s.id}
                          href={`/crew/studio/${s.id}`}
                          className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs transition-colors hover:border-accent-green"
                        >
                          {logo && (
                            <span className="flex h-6 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-white">
                              <Image
                                src={logo}
                                alt=""
                                width={40}
                                height={24}
                                className="h-full w-full object-contain"
                              />
                            </span>
                          )}
                          <span>{s.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {orderedDepartments.map((department) => (
                <section key={department}>
                  <h4 className="mb-2 text-sm font-semibold text-muted">{department}</h4>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    {crewByDepartment.get(department)!.map((member) => (
                      <li key={`${member.id}-${member.job}`} className="min-w-0 text-sm">
                        <Link
                          href={`/crew/person/${member.id}`}
                          className="block truncate hover:text-accent-green hover:underline"
                        >
                          {member.name}
                        </Link>
                        <span className="block truncate text-xs text-muted">{member.job}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {cast.length > 0 && (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-muted">
                    Cast <span className="font-normal">({cast.length})</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {cast.map((member) => (
                      <Link
                        key={member.id}
                        href={`/crew/person/${member.id}`}
                        className="group flex items-center gap-2"
                      >
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                          {member.profile_path ? (
                            <Image
                              src={profileUrl(member.profile_path, "w45")!}
                              alt={member.name}
                              width={36}
                              height={36}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted">
                              {member.name[0]}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm transition-colors group-hover:text-accent-green">
                            {member.name}
                          </p>
                          <p className="truncate text-xs text-muted">{member.character}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
        </Dialog>
      )}
    </>
  );
}
