-- CreateTable
CREATE TABLE "DismissedMovie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    CONSTRAINT "DismissedMovie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DismissedMovie_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DismissedMovie_userId_idx" ON "DismissedMovie"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DismissedMovie_userId_movieId_key" ON "DismissedMovie"("userId", "movieId");
