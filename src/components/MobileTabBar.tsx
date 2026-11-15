"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "@/components/NavIcon";
import { isActivePath } from "@/components/NavLinks";

type Tab = { href: string; label: string; icon: NavIconName };

// The five places people go most, one thumb-tap away on phones and tablets.
// The header's slide-in menu still lists everything; this is the shortcut.
// Hidden from lg up, where the header shows the full tab strip instead.
export function MobileTabBar({ username }: { username: string | null }) {
  const pathname = usePathname();

  const tabs: Tab[] = username
    ? [
        { href: "/", label: "Home", icon: "home" },
        { href: "/search", label: "Search", icon: "search" },
        { href: "/watchlist", label: "Watchlist", icon: "bookmark" },
        { href: "/challenges", label: "Challenges", icon: "trophy" },
        { href: `/profile/${username}`, label: "Profile", icon: "user" },
      ]
    : [
        { href: "/", label: "Home", icon: "home" },
        { href: "/search", label: "Search", icon: "search" },
        { href: "/lists", label: "Lists", icon: "list" },
        { href: "/play", label: "Play", icon: "gamepad" },
        { href: "/login", label: "Sign in", icon: "user" },
      ];

  return (
    <nav
      aria-label="Quick navigation"
      // env(safe-area-inset-bottom) keeps the bar clear of the iPhone home
      // indicator.
      className="fixed inset-x-0 bottom-0 z-40 select-none border-t border-white/[0.06] bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                // Tapping the tab you're already on goes back to the top of
                // the page, as it does in a phone's own apps.
                onClick={(e) => {
                  if (pathname !== tab.href) return;
                  e.preventDefault();
                  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                  window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
                }}
                className={`group relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-accent-green" : "text-muted hover:text-foreground"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 animate-fade-in rounded-full bg-accent-green"
                  />
                )}
                <NavIcon
                  name={tab.icon}
                  className="h-[22px] w-[22px] transition-transform duration-150 group-active:scale-90"
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
