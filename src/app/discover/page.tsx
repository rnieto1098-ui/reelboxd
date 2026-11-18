import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getDiscoverFeed } from "@/lib/discover/feed";
import { MOODS, RUNTIME_LIMITS, moodById, parseRuntimeLimit } from "@/lib/discover/taste";
import { DiscoverView } from "@/components/discover/DiscoverView";
import { DiscoverSkeleton } from "@/components/discover/DiscoverSkeleton";

export const metadata: Metadata = { title: "Discover" };

type SearchParams = Promise<{ mood?: string; time?: string }>;

function chipHref(mood: string | null, time: number | null) {
  const params = new URLSearchParams();
  if (mood) params.set("mood", mood);
  if (time) params.set("time", String(time));
  const qs = params.toString();
  return qs ? `/discover?${qs}` : "/discover";
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/discover");
  const userId = session.user.id;

  const params = await searchParams;
  const mood = moodById(params.mood);
  const time = parseRuntimeLimit(params.time);

  const chip = (active: boolean) =>
    `chip pointer-coarse:px-3.5 pointer-coarse:py-2 ${active ? "chip-active" : "hover:border-foreground/40 hover:text-foreground"}`;

  return (
    <div>
      <header className="mb-6">
        <p className="eyebrow mb-2">Discover</p>
        <h1 className="page-title">Something to watch tonight</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Everything here is streaming on your services, picked from what you rate, log and skip.
          Tell it what you&apos;re in the mood for.
        </p>
      </header>

      <nav aria-label="Mood" className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href={chipHref(null, time)} className={chip(!mood)} aria-current={!mood ? "page" : undefined}>
          Anything
        </Link>
        {MOODS.map((m) => (
          <Link
            key={m.id}
            href={chipHref(m.id, time)}
            className={chip(mood?.id === m.id)}
            aria-current={mood?.id === m.id ? "page" : undefined}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Running time" className="no-scrollbar -mx-4 mb-8 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <span className="shrink-0 text-xs text-subtle">Time</span>
        <Link href={chipHref(mood?.id ?? null, null)} className={chip(time == null)}>
          Any length
        </Link>
        {RUNTIME_LIMITS.map((t) => (
          <Link key={t} href={chipHref(mood?.id ?? null, t)} className={chip(time === t)}>
            Under {t === 90 ? "90 min" : "2 hrs"}
          </Link>
        ))}
      </nav>

      {/* Keyed on the filters so changing a chip shows the skeleton again
          instead of the previous mood's rows. */}
      <Suspense key={`${mood?.id ?? "all"}-${time ?? "any"}`} fallback={<DiscoverSkeleton />}>
        <Feed userId={userId} mood={mood} time={time} />
      </Suspense>
    </div>
  );
}

async function Feed({
  userId,
  mood,
  time,
}: {
  userId: string;
  mood: ReturnType<typeof moodById>;
  time: ReturnType<typeof parseRuntimeLimit>;
}) {
  const feed = await getDiscoverFeed(userId, mood, time);

  if (feed.services.length === 0) {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center sm:p-8">
        <h2 className="section-title mb-2">Which services do you have?</h2>
        <p className="mb-5 text-sm text-muted">
          Discover only shows films you can stream right now, so it needs to know your services
          first. It takes a few seconds.
        </p>
        <Link href="/streaming" className="btn btn-primary">
          Choose my services
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-5 text-xs text-subtle">
        On {feed.services.map((s) => s.name).join(", ")} ·{" "}
        <Link href="/streaming" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
          Change services
        </Link>
        {feed.signalCount < 5 && (
          <>
            {" · "}
            <Link href="/search" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
              Rate a few films
            </Link>{" "}
            to make these yours
          </>
        )}
      </p>
      {feed.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong px-5 py-8 text-center text-sm text-muted">
          Nothing on your services fits that right now.{" "}
          <Link href="/discover" className="text-accent-green hover:underline">
            Show everything
          </Link>
        </div>
      ) : (
        <DiscoverView rows={feed.rows} services={feed.services} watchlistIds={feed.watchlistIds} />
      )}
    </>
  );
}
