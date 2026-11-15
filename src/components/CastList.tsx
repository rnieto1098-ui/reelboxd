import Image from "next/image";
import Link from "next/link";
import { profileUrl } from "@/lib/tmdb";
import { HorizontalScroller } from "@/components/HorizontalScroller";

export type CastCard = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

/**
 * The billed cast as a row of portrait cards, each linking to that person's
 * page. Takes only the fields it draws, already cut down to the top billing
 * by the caller: the page used to hand this the whole TMDB cast array (often
 * well over a hundred people) to show three.
 */
export function CastList({ cast }: { cast: CastCard[] }) {
  return (
    <HorizontalScroller title="Cast" isEmpty={cast.length === 0} emptyMessage="No cast listed.">
      {cast.map((member) => (
        <Link
          key={member.id}
          href={`/crew/person/${member.id}`}
          className="group w-[6.5rem] shrink-0 sm:w-28"
        >
          <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface ring-1 ring-white/[0.08] transition-[transform,box-shadow] duration-300 ease-out-expo group-hover:-translate-y-1 group-hover:ring-white/25">
            {member.profile_path ? (
              <Image
                src={profileUrl(member.profile_path, "w185")!}
                alt=""
                width={185}
                height={278}
                sizes="112px"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface-hover to-surface text-2xl font-semibold text-subtle">
                {member.name[0]}
              </div>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-foreground/90 group-hover:text-foreground">
            {member.name}
          </p>
          {member.character && (
            <p className="line-clamp-2 text-xs leading-snug text-subtle">{member.character}</p>
          )}
        </Link>
      ))}
    </HorizontalScroller>
  );
}
