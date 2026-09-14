import Image from "next/image";
import Link from "next/link";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { profileUrl, type TmdbPerson } from "@/lib/tmdb";

export function PersonRow({ title, people }: { title: string; people: TmdbPerson[] }) {
  return (
    <HorizontalScroller title={title} isEmpty={people.length === 0}>
      {people.map((person) => {
        const photo = profileUrl(person.profile_path, "w185");
        return (
          <Link
            key={person.id}
            href={`/crew/person/${person.id}`}
            className="group w-28 flex-shrink-0 text-center sm:w-32 md:w-36"
          >
            <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-border bg-surface sm:h-32 sm:w-32 md:h-36 md:w-36">
              {photo ? (
                <Image
                  src={photo}
                  alt={person.name}
                  width={144}
                  height={144}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted">
                  {person.name[0]}
                </div>
              )}
            </div>
            <p
              title={person.name}
              className="mt-1.5 truncate text-sm font-medium group-hover:text-accent-green"
            >
              {person.name}
            </p>
          </Link>
        );
      })}
    </HorizontalScroller>
  );
}
