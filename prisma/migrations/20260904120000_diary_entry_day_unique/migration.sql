-- AlterTable
ALTER TABLE "DiaryEntry" ADD COLUMN "watchedDay" DATETIME;

-- Backfill: watchedDay = watchedDate truncated to UTC midnight, for every
-- row that already exists.
UPDATE "DiaryEntry"
SET "watchedDay" = strftime('%Y-%m-%dT00:00:00.000Z', "watchedDate");

-- Defensive cleanup: the app-level "one log per movie per day" check
-- (createDiaryEntry) has a race window that could already have let a
-- duplicate through before this migration. Keep only the earliest row per
-- (userId, movieId, watchedDay) so the unique index below can be created —
-- this is exactly the "treat the second log as if it never happened"
-- behavior the app already promises, just applied retroactively.
DELETE FROM "DiaryEntry"
WHERE "id" NOT IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "userId", "movieId", "watchedDay"
             ORDER BY "createdAt" ASC, "id" ASC
           ) AS rn
    FROM "DiaryEntry"
  )
  WHERE rn = 1
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaryEntry_userId_movieId_watchedDay_key" ON "DiaryEntry"("userId", "movieId", "watchedDay");
