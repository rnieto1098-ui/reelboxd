import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  ListChecks,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BookOpen,
    title: "A diary of everything you watch",
    body: "Log a film in one click, rate it out of five, and look back on any day, month or year.",
  },
  {
    icon: Bookmark,
    title: "A watchlist that knows your services",
    body: "Tell Flixtally what you subscribe to and it shows which saved films you can stream tonight.",
  },
  {
    icon: Sparkles,
    title: "Picks based on your taste",
    body: "Recommendations drawn from the directors, actors and genres you rate highest.",
  },
  {
    icon: ListChecks,
    title: "Lists worth working through",
    body: "Best Picture winners, top 250s and more, each with your progress, plus lists of your own.",
  },
  {
    icon: Trophy,
    title: "Challenges and a daily game",
    body: "Set a yearly goal, take on a director's whole filmography, or guess today's mystery film.",
  },
  {
    icon: BarChart3,
    title: "Your year in film",
    body: "Stats on what, when and who you watch, and a year-in-review to share.",
  },
];

/**
 * What a signed-out visitor sees first: what the site is and a way in, over
 * a still from whichever film is trending this week. The still changes with
 * TMDB's trending list, so the page never looks dated.
 */
export function LandingHero({
  backdrop,
  still,
  signupsOpen,
}: {
  backdrop: string | null;
  // The film the background still comes from, credited in the corner.
  still: { id: number; title: string; year: string | null } | null;
  signupsOpen: boolean;
}) {
  return (
    <>
      <section className="bleed relative -mt-8 mb-12 overflow-hidden bg-surface">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-[center_20%]"
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-background/55" />
        <div aria-hidden className="scrim-bottom absolute inset-0" />

        <div className="container-page relative flex min-h-[520px] flex-col items-center justify-center py-20 text-center sm:min-h-[600px]">
          <p className="eyebrow mb-4 animate-fade-up">Your film life, in one place</p>
          <h1 className="max-w-3xl animate-fade-up text-balance text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow-lg sm:text-6xl lg:text-7xl">
            Every film you watch, <span className="text-accent-green">tallied.</span>
          </h1>
          <p
            className="mt-5 max-w-xl animate-fade-up text-pretty text-base leading-relaxed text-foreground/85 sm:text-lg"
            style={{ animationDelay: "80ms" }}
          >
            Keep a diary of what you watch, build a watchlist that knows what&apos;s on your
            streaming services, and always have something good to put on next.
          </p>
          <div
            className="mt-8 flex animate-fade-up flex-wrap justify-center gap-3"
            style={{ animationDelay: "160ms" }}
          >
            {signupsOpen ? (
              <Link href="/signup" className="btn btn-primary btn-lg">
                Create your free account
              </Link>
            ) : (
              <span className="btn btn-secondary btn-lg cursor-default">
                Sign-ups are closed right now
              </span>
            )}
            <Link href="/login" className="btn btn-secondary btn-lg backdrop-blur-md">
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-foreground/60">Free to use. No ads.</p>
        </div>

        {still && (
          <Link
            href={`/movie/${still.id}`}
            className="absolute bottom-3 right-4 text-[11px] text-foreground/55 transition-colors hover:text-foreground"
          >
            Still from {still.title}
            {still.year ? ` (${still.year})` : ""}
          </Link>
        )}
      </section>

      <section aria-labelledby="features-heading" className="mb-14">
        <h2 id="features-heading" className="sr-only">
          What you can do with Flixtally
        </h2>
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="card p-5" style={{ "--i": i } as React.CSSProperties}>
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-green-soft text-accent-green">
                <Icon aria-hidden className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <h3 className="font-sans text-[15px] font-semibold tracking-normal">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
