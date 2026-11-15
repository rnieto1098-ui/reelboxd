import Image from "next/image";
import type { ReactNode } from "react";
import { BookOpen, Bookmark, Sparkles } from "lucide-react";

const POINTS = [
  { icon: BookOpen, text: "A diary of every film you watch" },
  { icon: Bookmark, text: "A watchlist that knows your streaming services" },
  { icon: Sparkles, text: "Picks based on what you actually like" },
];

/**
 * The frame shared by sign in, sign up and the password reset pages: the
 * form on one side, and on wider screens a panel of artwork with a reminder
 * of what the account is for.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto my-2 grid grid-cols-1 max-w-4xl animate-fade-up overflow-hidden rounded-2xl border border-border bg-surface shadow-pop sm:my-8 md:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden min-h-[34rem] md:block">
        <Image
          src="/backgrounds/empty-theater.webp"
          alt=""
          fill
          sizes="(min-width: 768px) 420px, 0px"
          priority
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20"
        />
        <div className="absolute inset-x-0 bottom-0 p-8">
          <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight">
            Every film you watch, <span className="text-accent-green">tallied.</span>
          </p>
          <ul className="mt-5 space-y-3 text-sm text-foreground/85">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-green-soft text-accent-green">
                  <Icon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-10">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-border pt-5 text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

/** An inline message under a form: red for a problem, green for success. */
export function FormMessage({
  kind = "error",
  children,
}: {
  kind?: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${
        kind === "error"
          ? "border-danger/40 bg-danger/10 text-red-200"
          : "border-accent-green/40 bg-accent-green-soft text-foreground"
      }`}
    >
      {children}
    </p>
  );
}
