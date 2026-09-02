import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { SearchBox } from "@/components/SearchBox";
import { MobileNav, type MobileNavItem } from "@/components/MobileNav";

export async function NavBar() {
  const session = await auth();

  const mobileNavItems: MobileNavItem[] = [
    { href: "/", label: "Home" },
    ...(session?.user
      ? [
          { href: "/recommend", label: "Recommend Me" },
          { href: "/lists", label: "Lists" },
          { href: "/watchlist", label: "Watchlist" },
          { href: "/challenges", label: "Challenges" },
        ]
      : [{ href: "/lists", label: "Lists" }]),
    { href: "/crew", label: "Crew" },
    // The header hides the username link below sm to make room for the
    // search box — this is mobile's only other way back to your profile.
    ...(session?.user
      ? [{ href: `/profile/${session.user.name}`, label: `${session.user.name} (Profile)` }]
      : []),
  ];

  return (
    <header className="border-b border-border bg-surface">
      <div className="relative mx-auto max-w-[1600px] px-4 py-3 flex items-center justify-between gap-6">
        <div className="flex shrink-0 items-center gap-2">
          <MobileNav items={mobileNavItems} />
          <Link href="/" className="text-xl font-bold tracking-tight text-accent-green">
            Flixtally
          </Link>
        </div>

        <div className="flex items-center gap-6 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            {session?.user && (
              <>
                <Link href="/recommend" className="hover:text-foreground transition-colors">
                  Recommend Me
                </Link>
                <Link href="/lists" className="hover:text-foreground transition-colors">
                  Lists
                </Link>
                <Link href="/watchlist" className="hover:text-foreground transition-colors">
                  Watchlist
                </Link>
                <Link href="/challenges" className="hover:text-foreground transition-colors">
                  Challenges
                </Link>
              </>
            )}
            {!session?.user && (
              <Link href="/lists" className="hover:text-foreground transition-colors">
                Lists
              </Link>
            )}
          </nav>

          <SearchBox />

          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted">
            <Link href="/crew" className="hover:text-foreground transition-colors">
              Crew
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {session?.user && (
            <Link
              href={`/profile/${session.user.name}`}
              className="hidden text-sm font-medium hover:text-accent-green transition-colors sm:inline-flex"
            >
              {session.user.name}
            </Link>
          )}

          {session?.user ? (
            <SignOutButton />
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-sm rounded-md bg-accent-green px-3 py-1.5 font-medium text-black hover:opacity-90 transition-opacity"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
