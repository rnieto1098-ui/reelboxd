"use client";

import { useState } from "react";
import Image from "next/image";
import { profileUrl, type TmdbCastMember } from "@/lib/tmdb";

const COLLAPSED_COUNT = 3;
const MAX_COUNT = 30;

export function CastList({ cast }: { cast: TmdbCastMember[] }) {
  const [expanded, setExpanded] = useState(false);
  const capped = cast.slice(0, MAX_COUNT);
  const visible = expanded ? capped : capped.slice(0, COLLAPSED_COUNT);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {visible.map((member) => (
          <div key={member.id} className="flex items-center gap-2">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-surface">
              {member.profile_path ? (
                <Image
                  src={profileUrl(member.profile_path, "w45")!}
                  alt={member.name}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted">
                  {member.name[0]}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{member.name}</p>
              <p className="truncate text-xs text-muted">{member.character}</p>
            </div>
          </div>
        ))}
      </div>

      {capped.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-accent-green hover:underline"
        >
          {expanded ? "Show less" : `Show all cast (${capped.length})`}
        </button>
      )}
    </div>
  );
}
