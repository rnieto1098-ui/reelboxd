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
    // On phones: label above, the select filling its grid cell, and 16px
    // text, because iOS Safari zooms the whole page into any field with
    // smaller text and leaves it zoomed after you pick an option.
    <label className="flex min-w-0 flex-col gap-1 text-xs sm:flex-row sm:items-center sm:gap-1.5">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const option = options.find((o) => o.value === e.target.value);
          if (option) router.push(option.href);
        }}
        className="w-full min-w-0 truncate rounded-md border border-border bg-surface px-2 py-1.5 text-base text-foreground focus:outline-none focus:border-accent-green sm:w-auto sm:max-w-56 sm:py-1 sm:text-xs"
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
