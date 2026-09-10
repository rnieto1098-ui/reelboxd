-- Defensive cleanup: the app-level dedupe in POST /api/challenges has a race
-- window (check-then-create) that could already have let a duplicate LIST
-- challenge through before this migration. Keep only the earliest row per
-- (userId, type, listId) so the unique index below can be created — that
-- matches what the pre-check already promises, applied retroactively.
--
-- Scoped to listId IS NOT NULL: rows where it's null are GENRE/TIMEFRAME/CREW
-- challenges, which are legitimately allowed to repeat per user and which the
-- index below won't constrain anyway (SQLite treats NULLs as distinct).
DELETE FROM "Challenge"
WHERE "listId" IS NOT NULL
  AND "id" NOT IN (
    SELECT "id" FROM (
      SELECT "id",
             ROW_NUMBER() OVER (
               PARTITION BY "userId", "type", "listId"
               ORDER BY "createdAt" ASC, "id" ASC
             ) AS rn
      FROM "Challenge"
      WHERE "listId" IS NOT NULL
    )
    WHERE rn = 1
  );

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_userId_type_listId_key" ON "Challenge"("userId", "type", "listId");
