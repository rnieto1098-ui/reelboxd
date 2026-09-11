"use client";

import { useRouter } from "next/navigation";

export type FilterOption = { value: string; label: string; href: string };

/**
 * A `<select>` that navigates on change rather than submitting a form —
 * the dropdown counterpart to SortChips/AvailabilityFilterLinks' pure
 * `<Link>` pills. Each option already carries its own destination href
 * (built server-side from the current search params plus that one option's
 * value), so this component owns no filter logic of its own — it's just
 * presentation and navigation, same division of labor as those two.
 */
export function FilterSelect({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: FilterOption[];
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const option = options.find((o) => o.value === e.target.value);
          if (option) router.push(option.href);
        }}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent-green"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
