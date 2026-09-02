-- CreateTable
CREATE TABLE "MovieProviderSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerIds" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "movieId" TEXT NOT NULL,
    CONSTRAINT "MovieProviderSnapshot_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MovieProviderSnapshot_movieId_key" ON "MovieProviderSnapshot"("movieId");

-- CreateTable
CREATE TABLE "ProviderAddition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" INTEGER NOT NULL,
    "providerName" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movieId" TEXT NOT NULL,
    CONSTRAINT "ProviderAddition_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProviderAddition_detectedAt_idx" ON "ProviderAddition"("detectedAt");

-- CreateIndex
CREATE INDEX "ProviderAddition_movieId_idx" ON "ProviderAddition"("movieId");
