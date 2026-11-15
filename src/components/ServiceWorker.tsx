"use client";

import { useEffect } from "react";
// Imported for its side effect: it starts listening for the browser's
// install offer as soon as the page loads, before any Install button mounts.
import "@/lib/installPrompt";

// Registers public/sw.js, which shows an "offline" page when there's no
// connection. Skipped in development, where a service worker only gets in
// the way of live reloading.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not being able to register only costs the offline page.
    });
  }, []);
  return null;
}
