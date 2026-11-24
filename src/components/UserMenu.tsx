"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  LogOut,
  Settings,
  ShieldCheck,
  Tv,
  User,
  type LucideIcon,
} from "lucide-react";
import { avatarSrc } from "@/lib/avatars";

// The signed-in user's avatar in the header, opening the account menu.
export function UserMenu({
  username,
  image,
  isAdmin = false,
}: {
  username: string;
  image: string | null;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `/profile/${username}`, label: "Profile", icon: User },
    { href: `/profile/${username}/diary`, label: "Diary", icon: BookOpen },
    { href: `/profile/${username}/stats`, label: "Stats", icon: BarChart3 },
    { href: "/streaming", label: "Streaming services", icon: Tv },
    { href: "/settings", label: "Settings", icon: Settings },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const itemClass =
    "flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-white/[0.06] hover:text-foreground";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
        title={username}
        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-surface text-sm font-bold text-accent-green transition-[border-color,box-shadow] ${
          open
            ? "border-accent-green shadow-[0_0_0_3px_var(--accent-green-soft)]"
            : "border-border-strong hover:border-accent-green"
        }`}
      >
        <Image
          src={avatarSrc(image, username)}
          alt=""
          width={36}
          height={36}
          className="h-full w-full object-cover"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-border-strong bg-surface-raised py-1.5 shadow-pop"
        >
          <div className="mb-1 border-b border-border px-3.5 pb-2.5 pt-1.5">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="truncate text-sm font-semibold">{username}</p>
          </div>
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} role="menuitem" href={href} className={itemClass}>
              <Icon aria-hidden className="h-4 w-4 text-muted" strokeWidth={1.9} />
              {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              signOut({ callbackUrl: "/" });
            }}
            className={`${itemClass} mt-1 border-t border-border pt-2.5`}
          >
            <LogOut aria-hidden className="h-4 w-4 text-muted" strokeWidth={1.9} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
