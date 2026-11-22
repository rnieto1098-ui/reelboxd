-- CreateTable
CREATE TABLE "ChallengeFilm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "releaseDate" TEXT,
    "position" INTEGER NOT NULL,
    "challengeId" TEXT NOT NULL,
    CONSTRAINT "ChallengeFilm_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChallengeFilm_challengeId_idx" ON "ChallengeFilm"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeFilm_challengeId_tmdbId_key" ON "ChallengeFilm"("challengeId", "tmdbId");
