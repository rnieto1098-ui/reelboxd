-- AlterTable
ALTER TABLE "User" ADD COLUMN "letterboxdWatchlistSyncedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "letterboxdWatchlistSyncBroken" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LetterboxdWatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filmSlug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "LetterboxdWatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LetterboxdWatchlistItem_userId_filmSlug_key" ON "LetterboxdWatchlistItem"("userId", "filmSlug");

-- CreateTable
CREATE TABLE "LetterboxdFilmMapping" (
    "filmSlug" TEXT NOT NULL PRIMARY KEY,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
