"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// The pages the bottom tab bar opens directly. They are starting points, so
// they don't get a back button.
const ROOTS = new Set(["/", "/search", "/watchlist", "/challenges", "/lists", "/play", "/login"]);

/**
 * A back button for the installed app on phones.
 *
 * Opened from the home screen, the site has no browser toolbar, and on an
 * iPhone that means no way back from a film to the list it came from. CSS
 * shows this only in that mode (`standalone:`) and only below the desktop
 * breakpoint; in a normal browser tab it stays hidden.
 */
export function AppBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (ROOTS.has(pathname)) return null;

  return (
    <button
      type="button"
      data-app-back
      aria-label="Back"
      onClick={() => {
        // Opened straight onto this page (a shortcut or a shared link):
        // there's nothing to go back to, so go home instead.
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
      className="-ml-2 hidden h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-white/5 standalone:max-lg:flex"
    >
      <ChevronLeft aria-hidden className="h-6 w-6" />
    </button>
  );
}
