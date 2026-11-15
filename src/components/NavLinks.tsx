"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavIconName } from "@/components/NavIcon";

export type NavItem = { href: string; label: string; icon: NavIconName };

// "/" only matches the home page itself; every other tab also matches the
// pages underneath it (/lists/abc highlights Lists).
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The desktop tab strip. A client component only because the highlighted
// tab follows the current URL, which the server-rendered header can't see
// change during client-side navigation.
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="hidden h-full items-stretch whitespace-nowrap text-sm font-medium lg:flex xl:gap-1"
    >
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center px-2.5 transition-colors xl:px-3 ${
              active ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {item.label}
            <span
              aria-hidden
              className={`absolute inset-x-2.5 -bottom-px xl:inset-x-3 h-0.5 origin-center rounded-full bg-accent-green transition-transform duration-300 ease-out-expo ${
                active ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
