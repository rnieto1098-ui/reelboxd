"use client";

import { useState, type CSSProperties } from "react";

// 70% dimmer, i.e. 30% of full brightness.
const WATCHED_BRIGHTNESS = 0.3;

export function FadeWatchedControl({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted">
        <span>Fade watched</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-accent-green" : "bg-surface-hover border border-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      <div style={{ "--watched-brightness": enabled ? WATCHED_BRIGHTNESS : 1 } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}
