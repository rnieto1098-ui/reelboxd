"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

/**
 * The one pop-up window every modal in the app is built on.
 *
 * It wraps the browser's own <dialog> element, opened with showModal().
 * That is what provides the behaviour each hand-rolled overlay used to be
 * missing: Escape closes it, keyboard focus moves in and stays in until it
 * closes, focus returns to the button that opened it, and everything behind
 * it stops responding to clicks, tabbing and screen readers.
 *
 * Callers render it conditionally (`{open && <Dialog …>}`), so its contents
 * mount fresh each time and never linger in the page while closed.
 */
export function Dialog({
  title,
  onClose,
  children,
  size = "md",
  // For dialogs whose content is its own title (a video player).
  hideTitle = false,
  bare = false,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof SIZES;
  hideTitle?: boolean;
  // No padding or header bar: the content fills the panel edge to edge.
  bare?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Whatever opened the dialog, so focus can go back there afterwards.
    // Recorded once: on development's second effect run, focus is already
    // inside the dialog and would be recorded instead.
    if (!openerRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    const opener = openerRef.current;
    if (!dialog.open) dialog.showModal();
    // A modal <dialog> doesn't stop the page behind it from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      // Deliberately no dialog.close() here. Unmounting removes the element,
      // which closes it anyway, whereas calling close() fires the `close`
      // event and with it onClose. React runs effects twice in development,
      // so that made every dialog close itself the instant it opened.
      //
      // The browser only hands focus back on close(), so do that here. By
      // the time a real unmount's cleanup runs the dialog is out of the
      // page; during development's rehearsal run it is still open, the page
      // behind it is inert, and this is harmlessly ignored.
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      // `cancel` is the Escape key; `close` covers every other way out.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // A click that lands on the <dialog> itself is a click on the dimmed
      // area around the panel (the panel is a child and covers the rest).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // On phones an ordinary dialog becomes a sheet that slides up from the
      // bottom edge, where a thumb can reach its buttons. `bare` ones (the
      // trailer player) stay centred.
      className={`m-auto w-[calc(100vw-1.5rem)] ${SIZES[size]} max-h-[calc(100dvh-2rem)] animate-scale-in overflow-hidden rounded-2xl border border-border-strong bg-surface-raised p-0 text-foreground shadow-pop backdrop:bg-black/75 backdrop:backdrop-blur-sm ${
        bare
          ? ""
          : "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:animate-sheet-up max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:max-h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)]"
      }`}
    >
      <div
        className={`flex max-h-[calc(100dvh-2rem)] flex-col ${
          bare
            ? ""
            : "max-sm:max-h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)] max-sm:pb-[env(safe-area-inset-bottom)]"
        }`}
      >
        {!bare && (
          <span
            aria-hidden
            className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-white/20 sm:hidden"
          />
        )}
        {!bare && (
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3 sm:py-3.5">
            <h2 className={hideTitle ? "sr-only" : "section-title truncate"}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.07] hover:text-foreground"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </header>
        )}
        <div className={bare ? "relative min-h-0" : "min-h-0 flex-1 overflow-y-auto px-5 py-4"}>
          {bare && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          )}
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3 max-sm:[&>*]:flex-1">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
