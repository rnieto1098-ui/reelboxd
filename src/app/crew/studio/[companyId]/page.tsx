import Image from "next/image";
import { notFound } from "next/navigation";
import { discoverMoviesByCompany, getCompanyDetails, logoUrl } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";

export default async function StudioPage({
  params,
}: PageProps<"/crew/studio/[companyId]">) {
  const { companyId: companyIdParam } = await params;
  const companyId = Number(companyIdParam);
  if (!Number.isFinite(companyId)) notFound();

  const [details, movies] = await Promise.all([
    getCompanyDetails(companyId).catch(() => null),
    discoverMoviesByCompany(companyId).catch(() => ({ results: [] })),
  ]);

  if (!details) notFound();

  const logo = logoUrl(details.logo_path, "w154");

  return (
    <div>
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-3 sm:h-32 sm:w-32">
          {logo ? (
            <Image
              src={logo}
              alt={details.name}
              width={128}
              height={128}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-black">
              {details.name[0]}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{details.name}</h1>
          {(details.headquarters || details.origin_country) && (
            <p className="text-sm text-muted">
              {[details.headquarters, details.origin_country].filter(Boolean).join(" · ")}
            </p>
          )}
          {details.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted line-clamp-6">
              {details.description}
            </p>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Movies</h2>
      {movies.results.length === 0 ? (
        <p className="text-muted">No movies found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {movies.results.map((movie) => (
            <MovieCard
              key={movie.id}
              tmdbId={movie.id}
              title={movie.title}
              posterPath={movie.poster_path}
              year={movie.release_date?.slice(0, 4)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
