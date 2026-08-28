import Image from "next/image";
import Link from "next/link";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { logoUrl, type TmdbCompany } from "@/lib/tmdb";

export function StudioRow({ title, studios }: { title: string; studios: TmdbCompany[] }) {
  return (
    <HorizontalScroller title={title} isEmpty={studios.length === 0}>
      {studios.map((studio) => {
        const logo = logoUrl(studio.logo_path, "w154");
        return (
          <Link
            key={studio.id}
            href={`/crew/studio/${studio.id}`}
            className="group w-24 flex-shrink-0 text-center sm:w-28"
          >
            <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2 sm:h-28 sm:w-28">
              {logo ? (
                <Image
                  src={logo}
                  alt={studio.name}
                  width={96}
                  height={96}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-black">
                  {studio.name[0]}
                </div>
              )}
            </div>
            <p className="mt-1.5 truncate text-sm font-medium group-hover:text-accent-green">
              {studio.name}
            </p>
          </Link>
        );
      })}
    </HorizontalScroller>
  );
}
