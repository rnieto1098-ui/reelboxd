"use client";

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
      className={`rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground hover:border-accent-green disabled:opacity-50 disabled:hover:text-muted disabled:hover:border-border ${className}`.trim()}
    >
      🔀 Shuffle
    </button>
  );
}
