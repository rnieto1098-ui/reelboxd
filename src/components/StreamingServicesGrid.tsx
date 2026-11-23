"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { StreamingServiceToggle } from "@/components/StreamingServiceToggle";

type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

/** Lowercase letters and digits only, so "hbomax" finds "HBO Max" and "disney+" finds "Disney Plus". */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The service tiles with a search box above them. Tiles that don't match are
 * hidden rather than unmounted, so a tile toggled earlier keeps its state
 * when the search changes.
 */
export function StreamingServicesGrid({
  providers,
  selectedIds,
}: {
  providers: Provider[];
  selectedIds: number[];
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(selectedIds);
  const needle = normalize(query);
  const matches = (p: Provider) => !needle || normalize(p.provider_name).includes(needle);
  const matchCount = needle ? providers.filter(matches).length : providers.length;

  return (
    <>
      <div className="relative mb-4">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services"
          aria-label="Search streaming services"
          className="input pl-9"
        />
      </div>

      {matchCount === 0 && (
        <p className="text-sm text-muted">No services match &ldquo;{query.trim()}&rdquo;.</p>
      )}

      <div className="flex flex-wrap gap-3">
        {providers.map((provider) => (
          <div key={provider.provider_id} hidden={!matches(provider)}>
            <StreamingServiceToggle
              providerId={provider.provider_id}
              providerName={provider.provider_name}
              logoPath={provider.logo_path}
              initialSelected={selected.has(provider.provider_id)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
