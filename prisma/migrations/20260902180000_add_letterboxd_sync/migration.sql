-- AlterTable
ALTER TABLE "User" ADD COLUMN "letterboxdUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "letterboxdSyncedAt" DATETIME;

-- CreateTable
CREATE TABLE "LetterboxdSyncItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guid" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "LetterboxdSyncItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LetterboxdSyncItem_userId_guid_key" ON "LetterboxdSyncItem"("userId", "guid");
