// Split out from streaming.ts (which needs prisma + TMDB fetches) so these —
// pure, dependency-free — can be unit tested without any DB/network setup.

// Owning a movie makes it watchable right now, same as a subscription
// service does — used everywhere a page needs to know whether "on my
// streaming services" filtering is meaningful to offer at all (someone with
// no services but a few owned movies should still get it).
export function hasStreamingAvailability(
  userProviderIds: Set<number>,
  ownedTmdbIds: Set<number>
): boolean {
  return userProviderIds.size > 0 || ownedTmdbIds.size > 0;
}

export function isAvailableOnServices(
  providers: { provider_id: number }[],
  userProviderIds: Set<number>
): boolean {
  return providers.some((p) => userProviderIds.has(p.provider_id));
}

// Same check for callers that only have provider ids — the watchlist page
// reads them from the snapshot table, which stores ids alone rather than
// full provider objects.
export function isAvailableOnServiceIds(
  providerIds: Set<number>,
  userProviderIds: Set<number>
): boolean {
  for (const id of providerIds) {
    if (userProviderIds.has(id)) return true;
  }
  return false;
}
