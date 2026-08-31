"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "reelboxd:onboarding-dismissed";

export type ChecklistItem = { key: string; label: string; href: string; done: boolean };

// Starts hidden (rather than flashing visible-then-hidden) since
// localStorage isn't available during server rendering — it can only pop
// in once the client confirms it hasn't been dismissed, never pop out.
export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Reading an external system (localStorage) on mount, not deriving
    // state from a prop — same category as PosterPicker's fetch-on-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-system read, not derived state
    if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
  }, []);

  if (!visible || items.every((item) => item.done)) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Get more out of reelboxd</h2>
        <button type="button" onClick={dismiss} className="text-xs text-muted hover:text-foreground">
          Dismiss
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none ${
                item.done
                  ? "border-accent-green bg-accent-green text-black"
                  : "border-border text-transparent"
              }`}
            >
              ✓
            </span>
            {item.done ? (
              <span className="text-muted line-through">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-accent-green hover:underline">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
