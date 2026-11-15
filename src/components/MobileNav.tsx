"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NavIcon, type NavIconName } from "@/components/NavIcon";
import { isActivePath } from "@/components/NavLinks";
import { InstallAppMenuItem } from "@/components/InstallApp";

export type MobileNavItem = { href: string; label: string; icon: NavIconName };

// Below-lg replacement for the desktop tab strip: a slide-in panel listing
// every destination, opened from the menu button in the header.
export function MobileNav({ items }: { items: MobileNavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    // Move focus into the panel so keyboard and screen-reader users land in
    // the menu they just opened, and hand it back to the button on close.
    const opener = openerRef.current;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        // In the installed app a deep page shows Back here instead (see
        // AppBackButton); the menu stays one tap away on every tab-bar page.
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground lg:hidden standalone:[[data-app-back]+&]:hidden"
      >
        <Menu aria-hidden className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
          />
          <nav
            ref={panelRef}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-slide-in-left flex-col border-r border-border bg-surface pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] shadow-pop"
          >
            <div className="flex h-[var(--header-height)] shrink-0 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
                <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
                <span>
                  Flix<span className="text-accent-green">tally</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
                      active
                        ? "bg-accent-green-soft text-accent-green"
                        : "text-muted hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            {/* Renders nothing unless this device can install the app. */}
            <InstallAppMenuItem />
          </nav>
        </div>
      )}
    </>
  );
}
