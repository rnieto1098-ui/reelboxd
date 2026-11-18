"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Trophy, X } from "lucide-react";

// "celebrate" is for finishing something (a challenge, the yearly goal, the
// daily game): a gold toast that stays longer, plus a burst of confetti.
type ToastVariant = "success" | "error" | "celebrate";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(
  null
);

const DISMISS_MS: Record<ToastVariant, number> = {
  success: 3500,
  // Errors and celebrations stay longer: one asks the reader to do
  // something, the other is worth a moment.
  error: 6000,
  celebrate: 7000,
};
// Rapid actions (ticking off a row of posters) shouldn't stack a tower.
const MAX_VISIBLE = 4;
const CONFETTI_MS = 2600;

// Mounted once in the root layout. A plain context + fixed-position stack
// rather than a library — the app has no other toast-like UI to reuse
// conventions from, and this is small enough not to need one.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Changing this number mounts a fresh burst of confetti; 0 means none.
  const [confettiKey, setConfettiKey] = useState(0);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, message, variant }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS[variant])
      );
      if (variant === "celebrate") {
        setConfettiKey((k) => k + 1);
        if (confettiTimer.current) clearTimeout(confettiTimer.current);
        confettiTimer.current = setTimeout(() => setConfettiKey(0), CONFETTI_MS);
      }
    },
    [dismiss]
  );

  // Don't leave timers running against an unmounted provider.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {confettiKey > 0 && <Confetti key={confettiKey} />}
      {/* Bottom offset clears the iPhone home indicator. Errors are
          announced immediately (role="alert"); the rest wait their turn. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-sm animate-slide-up items-start gap-2.5 rounded-xl border py-2.5 pl-3.5 pr-2 text-sm shadow-pop backdrop-blur-xl ${
              t.variant === "error"
                ? "border-danger/40 bg-[#2a1215]/95 text-red-100"
                : t.variant === "celebrate"
                  ? "border-accent-gold/50 bg-[#2a2310]/95 font-medium text-foreground"
                  : "border-border-strong bg-surface-raised/95 text-foreground"
            }`}
          >
            {t.variant === "error" ? (
              <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            ) : t.variant === "celebrate" ? (
              <Trophy aria-hidden className="mt-0.5 h-4 w-4 shrink-0 animate-pop text-accent-gold" />
            ) : (
              <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
            )}
            <span className="min-w-0 flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-my-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const CONFETTI_COLORS = ["#00e054", "#f5c443", "#40bcf4", "#ff8000", "#f2f4f7"];
const CONFETTI_COUNT = 44;

// Evenly spread, repeatable pseudo-randomness from a piece's index: the same
// values on every render, which keeps React's render pure and needs no
// Math.random.
function spread(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A short fall of coloured paper across the screen. Pure CSS: each piece is
 * one element animated with a transform, so it runs on the compositor and
 * costs the page nothing. Hidden entirely for anyone who has asked their
 * device for reduced motion.
 */
function Confetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden motion-reduce:hidden"
    >
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block rounded-[2px]"
          style={
            {
              left: `${spread(i, 1) * 100}%`,
              width: 6 + spread(i, 2) * 6,
              height: 10 + spread(i, 3) * 8,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              "--drift": `${(spread(i, 4) - 0.5) * 240}px`,
              "--spin": `${360 + spread(i, 5) * 720}deg`,
              animation: `confetti-fall ${1.5 + spread(i, 6) * 1.0}s cubic-bezier(0.2, 0.6, 0.4, 1) ${
                spread(i, 7) * 0.35
              }s both`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within a ToastProvider");
  return showToast;
}
