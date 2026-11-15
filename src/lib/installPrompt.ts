"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether, and how, this device can install Flixtally as an app.
 *
 * - "prompt":    the browser offered an install prompt we can show on demand
 *                (Chrome, Edge and Samsung Internet).
 * - "ios":       iPhone or iPad, where installing is a manual step in the
 *                Share menu, so the best we can do is explain it.
 * - "installed": already running as the installed app.
 * - "none":      nothing to offer (or not known yet).
 */
export type InstallState = "prompt" | "ios" | "installed" | "none";

// Chrome's event; not in TypeScript's DOM types.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// The browser fires `beforeinstallprompt` once, early, and never again, so
// it's caught here at module load rather than inside a component that might
// not have mounted yet.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    justInstalled = true;
    emit();
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own, older flag for a home-screen app.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch screen gives it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function getSnapshot(): InstallState {
  if (justInstalled || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return "none";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, () => "none");
}

/** Shows the browser's install prompt. Resolves true if the app was installed. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // A prompt event can only be used once.
  deferred = null;
  emit();
  return outcome === "accepted";
}
