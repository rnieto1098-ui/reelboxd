import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { UserMenu } from "@/components/UserMenu";
import { prisma } from "@/lib/prisma";
import { hasAdminRole } from "@/lib/admin";
import { getSiteSettings } from "@/lib/siteSettings";
import { SearchBox } from "@/components/SearchBox";
import { MobileNav, type MobileNavItem } from "@/components/MobileNav";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { AppBackButton } from "@/components/AppBackButton";

export async function NavBar() {
  const session = await auth();
  const signedIn = !!session?.user;

  const [account, settings] = await Promise.all([
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { image: true, role: true, email: true },
        })
      : null,
    getSiteSettings(),
  ]);
  const isAdmin = account ? hasAdminRole(account) : false;

  // The same destinations in the same order on every screen size: the
  // desktop tabs, and the slide-in menu below the lg breakpoint.
  const navItems: NavItem[] = [
    { href: "/", label: "Home", icon: "home" },
    ...(signedIn ? [{ href: "/discover", label: "Discover", icon: "compass" } as const] : []),
    { href: "/lists", label: "Lists", icon: "list" },
    ...(signedIn
      ? [
          { href: "/watchlist", label: "Watchlist", icon: "bookmark" } as const,
          { href: "/challenges", label: "Challenges", icon: "trophy" } as const,
        ]
      : []),
    { href: "/couch", label: "Couch", icon: "tv" },
    { href: "/crew", label: "Crew", icon: "users" },
  ];

  // Phones and tablets have no bottom tab bar: the menu is where every
  // destination lives. Profile, Settings and Admin sit behind the avatar in
  // the top right, as on desktop, so they aren't repeated here.
  const mobileNavItems: MobileNavItem[] = [
    ...navItems,
    { href: "/search", label: "Search", icon: "search" },
    ...(signedIn
      ? []
      : [
          { href: "/login", label: "Sign in", icon: "user" } as const,
          { href: "/signup", label: "Create account", icon: "sparkles" } as const,
        ]),
  ];

  return (
    <>
      {/* pt keeps the bar below the notch and status bar when the site runs
          full screen as an installed app. */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container-page flex h-[var(--header-height)] items-center gap-3 lg:gap-6">
          <div className="flex shrink-0 items-center gap-1.5">
            <AppBackButton />
            <MobileNav items={mobileNavItems} />
            {/* Desktop only: below lg the logo opens the menu instead. */}
            <Link
              href="/"
              className="hidden items-center gap-2 lg:flex font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-foreground"
            >
              {/* Same artwork as app/icon.png, pre-sized in public/ for 3x screens. */}
              <Image src="/logo.png" alt="" width={32} height={32} priority className="h-8 w-8" />
              <span>
                Flix<span className="text-accent-green">tally</span>
              </span>
            </Link>
          </div>

          <NavLinks items={navItems} />

          <div className="flex min-w-0 flex-1 justify-end">
            <SearchBox />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {session?.user?.name ? (
              <UserMenu
                username={session.user.name}
                image={account?.image ?? null}
                isAdmin={isAdmin}
              />
            ) : (
              <div className="flex items-center gap-1 whitespace-nowrap">
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                {/* Only from sm up: at phone widths the pair pushed the page
                    wider than the screen. Create account is in the menu. */}
                <Link href="/signup" className="btn btn-primary btn-sm max-sm:hidden">
                  Join free
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {settings.announcement && (
        <div
          role="status"
          className="border-b border-accent-green/20 bg-accent-green-soft px-4 py-2 text-center text-sm text-foreground"
        >
          {settings.announcement}
        </div>
      )}
    </>
  );
}
