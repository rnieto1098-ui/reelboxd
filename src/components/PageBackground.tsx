"use client";

import { usePathname } from "next/navigation";
import { backgroundStyle } from "@/lib/backgrounds";

// The root layout doesn't re-render on client navigation, so the per-tab
// background has to follow the pathname here rather than on <body>. A fixed
// layer behind the page also avoids background-attachment: fixed, which
// mobile Safari ignores.
export function PageBackground({ stored }: { stored: string | null }) {
  const pathname = usePathname();
  const style = backgroundStyle(stored, pathname);
  if (!style) return null;
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={style} />;
}
