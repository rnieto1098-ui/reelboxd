-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- The admin area needs at least one admin to exist. The oldest account on a
-- site is the one its owner made when they set it up, so that account is
-- promoted here; every other account stays a regular user. More admins can
-- be added from the admin area afterwards.
UPDATE "User" SET "role" = 'ADMIN'
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "solved" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "GameResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'cron',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_userId_game_day_key" ON "GameResult"("userId", "game", "day");

-- CreateIndex
CREATE INDEX "GameResult_userId_game_idx" ON "GameResult"("userId", "game");

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");
