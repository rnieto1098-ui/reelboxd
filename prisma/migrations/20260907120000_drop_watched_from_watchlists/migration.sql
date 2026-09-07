-- A watchlist is films you still mean to see, so a film you've already seen
-- doesn't belong on it. Rating, logging or marking a film watched already
-- removed it, but nothing stopped it going back on afterwards — most easily
-- via the Letterboxd watchlist sync, which adds whatever is on the
-- Letterboxd watchlist regardless of what's been watched here. Anything
-- already in that state is cleaned up once, here; addToWatchlist in
-- lib/watchlist.ts is what keeps it from happening again.
--
-- Watched means the same three signals the app uses everywhere else: a
-- rating, a diary entry, or an undated watched mark.
DELETE FROM "WatchlistItem"
WHERE EXISTS (
    SELECT 1 FROM "Rating" r
    WHERE r."userId" = "WatchlistItem"."userId" AND r."movieId" = "WatchlistItem"."movieId"
  )
  OR EXISTS (
    SELECT 1 FROM "DiaryEntry" d
    WHERE d."userId" = "WatchlistItem"."userId" AND d."movieId" = "WatchlistItem"."movieId"
  )
  OR EXISTS (
    SELECT 1 FROM "WatchedItem" w
    WHERE w."userId" = "WatchlistItem"."userId" AND w."movieId" = "WatchlistItem"."movieId"
  );
