-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target" INTEGER,
    "genreName" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "personId" INTEGER,
    "personName" TEXT,
    "department" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Challenge_userId_idx" ON "Challenge"("userId");
