"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// The signed-in user's avatar in the header, opening a small menu with the
// profile link and Sign out — these used to sit as loose text in the header
// and collided with the nav at laptop widths.
export function UserMenu({ username, image }: { username: string; image: string | null }) {
  const [open, setOpen] = useState(false);
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
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover hover:text-accent-green transition-colors";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
        title={username}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-sm font-bold text-accent-green hover:border-accent-green transition-colors"
      >
        {image ? (
          <Image src={image} alt="" width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          username[0]?.toUpperCase()
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          <p className="truncate border-b border-border px-3 pb-2 pt-1 text-xs text-muted">
            Signed in as <span className="font-medium text-foreground">{username}</span>
          </p>
          <Link role="menuitem" href={`/profile/${username}`} className={itemClass}>
            Your profile
          </Link>
          <Link role="menuitem" href="/settings" className={itemClass}>
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={`${itemClass} border-t border-border`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
