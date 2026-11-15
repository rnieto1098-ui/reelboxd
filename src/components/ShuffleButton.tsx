"use client";

import { Shuffle } from "lucide-react";

export function ShuffleButton({
  onClick,
  disabled,
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`chip hover:border-accent-green hover:text-foreground disabled:opacity-40 disabled:hover:border-border-strong disabled:hover:text-muted ${className}`.trim()}
    >
      <Shuffle aria-hidden className="h-3 w-3" />
      Shuffle
    </button>
  );
}
