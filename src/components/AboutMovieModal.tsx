"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  logoUrl,
  profileUrl,
  type TmdbCastMember,
  type TmdbCrewMember,
  type TmdbGenre,
  type TmdbProductionCompany,
} from "@/lib/tmdb";

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
  studios: TmdbProductionCompany[];
  crew: TmdbCrewMember[];
  cast: TmdbCastMember[];
}) {
  const [open, setOpen] = useState(false);

  const crewByDepartment = new Map<string, TmdbCrewMember[]>();
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
        className="text-xs text-muted hover:text-accent-green hover:underline"
      >
        About
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-xs text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>

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
          </div>
        </div>
      )}
    </>
  );
}
