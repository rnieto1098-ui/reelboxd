-- CreateTable
CREATE TABLE "RewatchItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    CONSTRAINT "RewatchItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewatchItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RewatchItem_userId_movieId_key" ON "RewatchItem"("userId", "movieId");
