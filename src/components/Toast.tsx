"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

type ToastVariant = "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(
  null
);

const AUTO_DISMISS_MS = 3500;
// Errors stay longer: they usually ask the reader to do something.
const ERROR_DISMISS_MS = 6000;
// Rapid actions (ticking off a row of posters) shouldn't stack a tower.
const MAX_VISIBLE = 4;

// Mounted once in the root layout. A plain context + fixed-position stack
// rather than a library — the app has no other toast-like UI to reuse
// conventions from, and this is small enough not to need one.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

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
        setTimeout(() => dismiss(id), variant === "error" ? ERROR_DISMISS_MS : AUTO_DISMISS_MS)
      );
    },
    [dismiss]
  );

  // Don't leave timers running against an unmounted provider.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* bottom-20 on small screens clears the fixed tab bar. Errors are
          announced immediately (assertive); confirmations wait their turn. */}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end lg:bottom-5"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-sm animate-slide-up items-start gap-2.5 rounded-xl border py-2.5 pl-3.5 pr-2 text-sm shadow-pop backdrop-blur-xl ${
              t.variant === "error"
                ? "border-danger/40 bg-[#2a1215]/95 text-red-100"
                : "border-border-strong bg-surface-raised/95 text-foreground"
            }`}
          >
            {t.variant === "error" ? (
              <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
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

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within a ToastProvider");
  return showToast;
}
