import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { UserMenu } from "@/components/UserMenu";
import { prisma } from "@/lib/prisma";
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
    // Also reachable from the avatar menu; kept here so the hamburger menu
    // is a complete map of the site on its own.
    ...(session?.user
      ? [{ href: `/profile/${session.user.name}`, label: `${session.user.name} (Profile)` }]
      : [
          { href: "/login", label: "Sign in" },
          { href: "/signup", label: "Sign up" },
        ]),
  ];

  const navItems = [
    { href: "/", label: "Home" },
    ...(session?.user ? [{ href: "/recommend", label: "Recommend Me" }] : []),
    { href: "/lists", label: "Lists" },
    ...(session?.user
      ? [
          { href: "/watchlist", label: "Watchlist" },
          { href: "/challenges", label: "Challenges" },
        ]
      : []),
    { href: "/crew", label: "Crew" },
  ];

  const avatar = session?.user?.id
    ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true } }))
        ?.image ?? null
    : null;

  // Below lg the tab links live in the hamburger menu — at laptop widths
  // (~630–1000px) the full set used to overlap the account links and wrap
  // "Recommend Me" onto two lines.
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 lg:gap-6">
        <div className="flex shrink-0 items-center gap-2">
          <MobileNav items={mobileNavItems} />
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-accent-green"
          >
            {/* Same artwork as app/icon.png, pre-sized in public/ for 3x screens. */}
            <Image src="/logo.png" alt="" width={32} height={32} priority className="h-8 w-8" />
            Flixtally
          </Link>
        </div>

        <nav className="hidden items-center gap-5 whitespace-nowrap text-sm font-semibold text-foreground/90 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-accent-green transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 justify-end">
          <SearchBox />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {session?.user?.name ? (
            <UserMenu username={session.user.name} image={avatar} />
          ) : (
            // Hidden below sm — same links are in the mobile hamburger menu
            // (mobileNavItems above) instead, since at narrow widths this
            // pair used to sit alongside the search box with nowhere to
            // shrink to and pushed the page wider than the screen.
            <div className="hidden items-center gap-4 whitespace-nowrap sm:flex">
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
