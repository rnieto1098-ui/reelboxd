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
    ...(signedIn ? [{ href: "/recommend", label: "Recommend", icon: "sparkles" } as const] : []),
    { href: "/lists", label: "Lists", icon: "list" },
    ...(signedIn
      ? [
          { href: "/watchlist", label: "Watchlist", icon: "bookmark" } as const,
          { href: "/challenges", label: "Challenges", icon: "trophy" } as const,
        ]
      : []),
    { href: "/play", label: "Play", icon: "gamepad" },
    { href: "/crew", label: "Crew", icon: "users" },
  ];

  const mobileNavItems: MobileNavItem[] = [
    ...navItems,
    ...(signedIn
      ? [
          {
            href: `/profile/${session.user.name}`,
            label: "Your profile",
            icon: "user",
          } as const,
          { href: "/settings", label: "Settings", icon: "settings" } as const,
          ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "shield" } as const] : []),
        ]
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
            <Link
              href="/"
              className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-foreground"
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
              // Hidden below sm: the same links are in the slide-in menu and
              // the bottom tab bar, and at narrow widths this pair pushed the
              // page wider than the screen.
              <div className="hidden items-center gap-1 whitespace-nowrap sm:flex">
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-primary btn-sm">
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
