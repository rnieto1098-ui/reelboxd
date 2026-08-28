import Image from "next/image";
import Link from "next/link";
import { profileUrl, logoUrl, searchCompanies, searchPeople } from "@/lib/tmdb";
import { getBrowseRows } from "@/lib/crewBrowse";
import { PersonRow } from "@/components/PersonRow";
import { StudioRow } from "@/components/StudioRow";

export default async function CrewPage({ searchParams }: PageProps<"/crew">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  const [initialPeople, companies] = query
    ? await Promise.all([searchPeople(query), searchCompanies(query)])
    : [null, null];

  // TMDB's search does literal matching, not fuzzy matching — a first-name
  // typo (e.g. "John Bernthal" instead of "Jon Bernthal") returns zero
  // results even though the person is in TMDB. Retrying with just the last
  // word recovers most of these cases without needing real fuzzy search.
  let people = initialPeople;
  let fallbackQuery: string | null = null;
  if (query && people && people.results.length === 0) {
    const words = query.trim().split(/\s+/);
    const lastWord = words[words.length - 1];
    if (words.length > 1) {
      const fallback = await searchPeople(lastWord);
      if (fallback.results.length > 0) {
        people = fallback;
        fallbackQuery = lastWord;
      }
    }
  }

  const browseRows = query ? null : await getBrowseRows();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Crew</h1>
      <p className="mb-6 text-sm text-muted">
        Search for directors, actors, cinematographers, composers, producers, or studios, then
        browse everything they made.
      </p>

      <form action="/crew" className="mb-8">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search people or studios..."
          className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent-green"
        />
      </form>

      {query && people && companies && (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              People {people.results.length > 0 && `(${people.results.length})`}
            </h2>
            {fallbackQuery && (
              <p className="mb-3 text-sm text-muted">
                No exact match for &ldquo;{query}&rdquo; &mdash; showing results for &ldquo;
                {fallbackQuery}&rdquo; instead.
              </p>
            )}
            {people.results.length === 0 ? (
              <div className="text-sm text-muted">
                <p>No people found on TMDB for &ldquo;{query}&rdquo;.</p>
                <p className="mt-2">
                  Try{" "}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-green hover:underline"
                  >
                    Google
                  </a>{" "}
                  or{" "}
                  <a
                    href={`https://www.imdb.com/find/?q=${encodeURIComponent(query)}&s=nm`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-green hover:underline"
                  >
                    IMDb
                  </a>{" "}
                  instead &mdash; TMDB&apos;s database doesn&apos;t have everyone, especially
                  lesser-known crew.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {people.results.map((person) => {
                  const photo = profileUrl(person.profile_path, "w185");
                  return (
                    <Link
                      key={person.id}
                      href={`/crew/person/${person.id}`}
                      className="group text-center"
                    >
                      <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border border-border bg-surface sm:h-24 sm:w-24">
                        {photo ? (
                          <Image
                            src={photo}
                            alt={person.name}
                            width={96}
                            height={96}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted">
                            {person.name[0]}
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium group-hover:text-accent-green">
                        {person.name}
                      </p>
                      {person.known_for_department && (
                        <p className="text-xs text-muted">{person.known_for_department}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Studios {companies.results.length > 0 && `(${companies.results.length})`}
            </h2>
            {companies.results.length === 0 ? (
              <p className="text-sm text-muted">No studios found.</p>
            ) : (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {companies.results.map((company) => {
                  const logo = logoUrl(company.logo_path, "w154");
                  return (
                    <Link
                      key={company.id}
                      href={`/crew/studio/${company.id}`}
                      className="group text-center"
                    >
                      <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2 sm:h-24 sm:w-24">
                        {logo ? (
                          <Image
                            src={logo}
                            alt={company.name}
                            width={80}
                            height={80}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-black">
                            {company.name[0]}
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium group-hover:text-accent-green">
                        {company.name}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {browseRows && (
        <div className="space-y-10">
          <PersonRow title="Popular Directors" people={browseRows.directors} />
          <PersonRow title="Popular Actors" people={browseRows.actors} />
          <PersonRow title="Cinematographers" people={browseRows.cinematographers} />
          <StudioRow title="Studios" studios={browseRows.studios} />
        </div>
      )}
    </div>
  );
}
